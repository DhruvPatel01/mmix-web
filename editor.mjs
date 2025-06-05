import {basicSetup} from "codemirror"
import {indentWithTab,defaultKeymap} from "@codemirror/commands"
import {EditorState, StateEffect, StateField} from "@codemirror/state"
import {EditorView, keymap, Decoration} from "@codemirror/view"

import MMIXAL from "./dist/mmixal.js"
import MMIX from "./dist/mmix.js"
import {parse_mmo} from "./mmix_object_reader.mjs"



let hello_world_src = `     LOC		Data_Segment
        GREG	@
Text	BYTE	"Hello world!",10,0

        LOC		#100
    
Main	LDA		$255,Text
        TRAP	0,Fputs,StdOut
        TRAP	0,Halt,0

`

const setHighlightLine = StateEffect.define();
const removeAnyHighlight = StateEffect.define();
const lineHighlightDecoration = Decoration.line({
    attributes: {style: 'background-color: yellow'}
});
const lineHighlightField = StateField.define({
    create() {
      return Decoration.none;
    },
    update(lines, tr) {
      lines = lines.map(tr.changes);
      for (let e of tr.effects) if (e.is(setHighlightLine)) {
        lines = Decoration.set([lineHighlightDecoration.range(e.value)]);
      }
      for (let e of tr.effects) if (e.is(removeAnyHighlight)) {
        lines = Decoration.none;
      }
      return lines;
    },
    provide: (f) => EditorView.decorations.from(f),
  });

let state = EditorState.create({
  doc: hello_world_src,
  extensions: [basicSetup, keymap.of([indentWithTab, defaultKeymap]), lineHighlightField],
})

let editor = new EditorView({
  state: state,
  parent: document.getElementById("editor-div"),
})


let all_regs = [];
for (let i = 0; i <= 255; i++) all_regs.push("r" + i);
for (let i = 65; i <= 90; i++) all_regs.push("r" + String.fromCharCode(i));
for (let i of ['BB', 'TT', 'WW', 'XX', 'YY', 'ZZ']) all_regs.push("r" + i);


let mmix_state = {
    initialized: false,
    mmix: undefined,
    loc_to_line: undefined,
    next_command: undefined,
    capture_stdout: true,
    stdout_buffer: "",
    common_registers: [],
    special_registers: [],
    format: "!",
    ready_for_next_action: false,

    init: async function(mmo_content) {
        let MMIX_Module = {
            preRun: () => {
                mmix_state.stderr_buffer = [];
                mmix_state.stdout_buffer = [];
                MMIX_Module.FS.init(null, stdout_fn, null);
            }
        }

        const mmix = await MMIX(MMIX_Module);
        this.loc_to_line = parse_mmo(mmo_content);
        this.next_command = undefined;
        this.capture_stdout = true;
        this.stdout_buffer = "";
        this.ready_for_next_action = true;
        this.mmix = mmix;
        mmix.FS.writeFile("./code.mmo", mmo_content, {encoding: "binary"});
        mmix.callMain(["-i", "./code.mmo"]);
    },

    send_command: function(cmd) {
        this.ready_for_next_action = false;
        this.next_command(cmd);
        this.next_command = () => {
            console.log("No input requested from MMIX interpreter. May be it is terminated?");
        };
    },

    pause_until_ready: async function() {
        return new Promise((resolve) => {
            const poll = () => {
                if (this.ready_for_next_action) {
                    resolve();
                } else {
                    setTimeout(poll, 2);
                }
            };
            setTimeout(poll, 2);
        });
    },

    send_command_with_output: async function(cmd) {
        await this.pause_until_ready();
        const originalBuffer = this.stdout_buffer;
        this.stdout_buffer = "";
        this.capture_stdout = false;
        this.send_command(cmd);
       
        const output = await new Promise((resolve) => {
            const poll = () => {
                if (this.stdout_buffer.endsWith("mmix> ")) {
                    const result = this.stdout_buffer;
                    this.stdout_buffer = originalBuffer;
                    this.capture_stdout = true;
                    resolve(result);
                } else {
                    setTimeout(poll, .5);
                }
            };
            poll();
        });
        return output;
    },

    step: async function() {
        await this.pause_until_ready();
        this.send_command("\n");
        await this.maybe_set_hightlight();
    },


    get_current_location: async function() {
        await this.pause_until_ready();
        const output = await this.send_command_with_output("s\n");
        const match = output.match(/now at location #([0-9A-Fa-f]+)/);

        if (match) {
          const addressBigInt = BigInt('0x' + match[1]);
          return this.loc_to_line[addressBigInt];
        } else {
          console.log("No address found in the line.");
          return undefined;
        }
    },

    maybe_set_hightlight: async function() {
        const line = await this.get_current_location();
        if (line !== undefined) {
            highlightLine(line);
            const pos = editor.state.doc.line(line).from;
            editor.dispatch({
                effects: EditorView.scrollIntoView(pos, {
                  y: "center",
                }),
              });
        } else {
            removeHighlight();
        }
    },

    get_register: async function(register, format="!") {
        const output = await this.send_command_with_output(`${register}${format}\n`);
        return output.split('=').pop().split('\n')[0];
    },

    update_register_table: async function(format="!", change_visibility=true) {
        console.log("Updating registers with format:", format);
        const rL = parseInt(await this.get_register("rL", "!"));
        const rG = parseInt(await this.get_register("rG", "!"));

        async function update(state, id, reg) {
            const tr = document.getElementById(id);
            const old_val = tr.childNodes[1].innerHTML;
            const new_value = await state.get_register(reg, format);
            if (change_visibility && new_value !== old_val) {
                tr.classList.remove("hidden-reg");
            }
            tr.childNodes[1].innerHTML = new_value;
        }
        for (let i = 0; i < rL; i++) await update(this, `reg${i}`, `$${i}`);
        for (let i = rG; i <= 255; i++) await update(this, `reg${i}`, `$${i}`);
        console.log("Registers updated");
    }
}

async function compile() {
    let mmixal = await MMIXAL();
    let txt = editor.state.doc.toString();
    let maxLength = 80;
    for (let i = 0; i < editor.state.doc.lines; i++) {
      const line = editor.state.doc.line(i + 1);
      if (line.length > maxLength) {
        maxLength = line.length + 1;;
      }
    }
    const alfs = mmixal.FS;
    alfs.writeFile("./code.mms", txt, {encoding: "ascii"});
    mmixal.callMain([`-b ${maxLength}`, "./code.mms"]);

    let content = alfs.readFile("./code.mmo", {encoding: "binary"});

    return content;
}


let stdout_area = document.getElementById("the-terminal")
function stdout_fn(text) {
    mmix_state.stdout_buffer += String.fromCodePoint(text);
    mmix_state.ready_for_next_action = mmix_state.stdout_buffer.endsWith("mmix> ");
    if (mmix_state.capture_stdout && mmix_state.ready_for_next_action) {
        stdout_area.innerHTML += mmix_state.stdout_buffer;
        mmix_state.stdout_buffer = "";
        stdout_area.scrollTop = stdout_area.scrollHeight;
    } 
}

async function compileStep() {
    const mmo_content = await compile();
    await mmix_state.init(mmo_content);
    for (let reg of document.querySelectorAll('tr[id^="reg"]')) {
        reg.classList.add("hidden-reg");
    }
}

document.getElementById("compile-btn").addEventListener("click", async (e) => {
    await compileStep();
});


let step_btn = document.getElementById("step-btn");
step_btn.addEventListener("click", async (e) => {
    if (mmix_state.mmix === undefined) {
        console.log("Please compile first");
    } else if (!mmix_state.ready_for_next_action) {
        console.log("Please hold while previous step is complete.")
    } else {
        step_btn.disabled = true;
        await mmix_state.step();
        await mmix_state.update_register_table("!", true);
        step_btn.disabled = false;
    }
});


function submit_command() {
    return new Promise((accept, reject)=>{
        mmix_state.next_command = accept;
    });
}

function highlightLine(lineNo) {
    const docPosition = editor.state.doc.line(lineNo).from;
    editor.dispatch({effects: setHighlightLine.of(docPosition)});
}

function removeHighlight() {
    editor.dispatch({effects: removeAnyHighlight.of()});
}

globalThis.editor = editor;
globalThis.mmix_state = mmix_state;
globalThis.submit_command = submit_command;


//
const show_github_load_btn = document.getElementById("show-load-github-btn");
const github_load_btn = document.getElementById("load-github-btn");
show_github_load_btn.addEventListener("click", (e) => {
    document.getElementById("load-github-dialog").showModal();
});

github_load_btn.addEventListener("click", async (e) => {
    var github_url = document.getElementById("github-url").value;
    github_url = github_url.replace("//github.com", "//raw.githubusercontent.com");
    github_url = github_url.replace("blob/", "/");

    
    const error_box = document.getElementById("github-error-box");


    if (!github_url.includes("githubusercontent")) {
        error_box.innerHTML = "Please provide a valid GitHub URL.";
        return;
    }
    const response = await fetch(github_url);
    const dialog = document.getElementById("load-github-dialog");
    if (response.ok) {
        const text = await response.text();
        editor.dispatch({changes: {from: 0, to: editor.state.doc.length, insert: text}});
        error_box.innerHTML = "";
        compileStep();
        dialog.close();
    } else {
        error_box.innerHTML = `Error loading file from GitHub: ${response.status} ${response.statusText}`;
    }
});