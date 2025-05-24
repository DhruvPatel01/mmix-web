import {basicSetup} from "codemirror"
import {indentWithTab,defaultKeymap} from "@codemirror/commands"
import {EditorState} from "@codemirror/state"
import {EditorView, keymap} from "@codemirror/view"

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

let state = EditorState.create({
  doc: hello_world_src,
  extensions: [basicSetup, keymap.of([indentWithTab, defaultKeymap])],
})

let editor = new EditorView({
  state: state,
  parent: document.getElementById("editor-div"),
})

let command = "" // command to be submitted to MMIX interpreter

/**
 * Update the register value
 * @param {String} register_id e.g., "r0"
 * @param {String} new_value e.g., "42"
 * @returns {Bool} if old value is same as new value then false. Else  true.
 */
function update_reg(register_id, new_value) {
    let row = document.getElementById(register_id);
    let old_value = row.cells[1].innerHTML;
    if (old_value != new_value) {
        row.cells[1].innerHTML = new_value;
        return true;
    } else {
        return false;
    }
}

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

    step: function() {
        this.next_command("\n");
        this.next_command = () => {
            console.log("No input requested from MMIX interpreter. May be it is terminated?");
        };
    },

    get_register_value: function(register, format) {
        console.log(register);
        return 42;
    },

    update_register_table: function(format="!", change_visibility=true) {
        ;
    }
}


async function compile() {
    let mmixal = await MMIXAL();
    let txt = state.doc.toString();
    const alfs = mmixal.FS;
    alfs.writeFile("./code.mms", txt, {encoding: "ascii"});
    mmixal.callMain(["./code.mms"]);

    let content = alfs.readFile("./code.mmo", {encoding: "binary"});

    return content;
}


let stdout_area = document.getElementById("xterm-container")
function stdout_fn(text) {
    if (text == 10) {
        let elem = document.createElement("div");
        elem.innerHTML = mmix_state.stdout_buffer;
        mmix_state.stdout_buffer = "";
        stdout_area.appendChild(elem);
    } else {
        mmix_state.stdout_buffer += String.fromCodePoint(text);
    }
}

document.getElementById("compile-btn").addEventListener("click", (e) => {
    compile().then((mmo_content) => {
        let MMIX_Module = {
            preRun: () => {
                mmix_state.stderr_buffer = [];
                mmix_state.stdout_buffer = [];
                MMIX_Module.FS.init(null, stdout_fn, null);
            }
        }

        MMIX(MMIX_Module).then((mmix) => {
            mmix_state.mmix = mmix;            
            mmix_state.loc_to_line = parse_mmo(mmo_content);
            
            mmix.FS.writeFile("./code.mmo", mmo_content, {encoding: "binary"});
            mmix.callMain(["-i", "./code.mmo"]);
        })
    });

});


let step_btn = document.getElementById("step-btn");
step_btn.addEventListener("click", (e) => {
    if (mmix_state.mmix === undefined) {
        console.log("Please compile first");
    } else {
        step_btn.disabled = true;
        mmix_state.step();
        step_btn.disabled = false;
    }
});


function submit_command() {
    return new Promise((accept, reject)=>{
        mmix_state.next_command = accept;
    });
}

globalThis.editor = editor;
globalThis.mmix_state = mmix_state;
globalThis.submit_command = submit_command;