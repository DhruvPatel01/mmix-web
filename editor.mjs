import { basicSetup } from "codemirror"
import { indentWithTab, defaultKeymap } from "@codemirror/commands"
import { EditorState, StateEffect, StateField, RangeSet } from "@codemirror/state"
import { EditorView, keymap, Decoration, gutter, GutterMarker } from "@codemirror/view"
import { StreamLanguage } from "@codemirror/language"


import MMIXAL from "./dist/mmixal.js"
import MMIX from "./dist/mmix.js"
import { parse_mmo } from "./mmix_object_reader.mjs"



let hello_world_src = `     LOC		Data_Segment
    OCTA #0
    BYTE #01
    BYTE #02
    BYTE #03
    BYTE #04
    BYTE #10
    BYTE #11
    BYTE #12
    BYTE #13

        GREG	@
Text	BYTE	"Hello world!",10,0

        LOC		#100
    
Main	LDA		$255,Text
        TRAP	0,Fputs,StdOut
        TRAP	0,Halt,0
`


const mmix_tokenizer = StreamLanguage.define({
    startState() {
        return {};
    },

    token(stream) {
        if (stream.eatSpace()) return null;

        if (stream.sol()) {
            if (stream.match(/^[A-Za-z_][_A-Za-z0-9]*/)) return "tag";
        }
        if (stream.match(/^;[A-Za-z_][_A-Za-z0-9]*/)) return "tag";

        if (stream.match(/\b(TRAP|FCMP|FUN|FEQL|FADD|FIX|FSUB|FIXU|FLOT|FLOTU|SFLOT|SFLOTU|FMUL|FCMPE|FUNE|FEQLE|FDIV|FSQRT|FREM|FINT|MUL|MULU|DIV|DIVU|ADD|ADDU|SUB|SUBU|2ADDU|4ADDU|8ADDU|16ADDU|CMP|CMPU|NEG|NEGU|SL|SLU|SR|SRU|BN|BZ|BP|BOD|BNN|BNZ|BNP|BEV|PBN|PBZ|PBP|PBOD|PBNN|PBNZ|PBNP|PBEV|CSN|CSZ|CSP|CSOD|CSNN|CSNZ|CSNP|CSEV|ZSN|ZSZ|ZSP|ZSOD|ZSNN|ZSNZ|ZSNP|ZSEV|LDA|LDB|LDBU|LDW|LDWU|LDT|LDTU|LDO|LDOU|LDSF|LDHT|CSWAP|LDUNC|LDVTS|PRELD|PREGO|GO|STB|STBU|STW|STWU|STT|STTU|STO|STOU|STSF|STHT|STCO|STUNC|SYNCD|PREST|SYNCID|PUSHGO|OR|ORN|NOR|XOR|AND|ANDN|NAND|NXOR|BDIF|WDIF|TDIF|ODIF|MUX|SADD|MOR|MXOR|SET|SETH|SETMH|SETML|SETL|INCH|INCMH|INCML|INCL|ORH|ORMH|ORML|ORL|ANDNH|ANDNMH|ANDNML|ANDNL|JMP|PUSHJ|GETA|PUT|POP|RESUME|UNSAVE|SYNC|SWYM|GET|TRIP)\b/)) {
            return "keyword";
        }
        if (stream.match(/\b(BYTE|WYDE|TETRA|OCTA)\b/)) return "keyword";
        if (stream.match(/\b(LOC|GREG|IS|BYTE|WYDE|TETRA|OCTA)\b/)) return "keyword";




        // Label (function-like names at beginning)
        if (stream.match(/^\b([A-Za-z]+[0-9]*|\d+H)\b\s/)) return "definition";

        // Comments
        if (stream.match(/^(\/\/|;|%|#\s).*$/)) return "comment";

        // General-purpose registers like $123
        if (stream.match(/^\$\d{1,3}\b/)) return "constant";

        // Special registers like rA, rB, ..., rZZ
        if (stream.match(/\b(r[ABCDEFGHIJKLMNOPQRSTUVWXYZZ]{1,2}|rBB|rTT|rWW|rXX|rYY|rZZ)\b/)) {
            return "storage.other.special.register.mmix";
        }

        // Decimal number
        if (stream.match(/^-?[0-9]+\b/)) return "number";

        // Hex number
        if (stream.match(/^(#|0x)[0-9a-fA-F_]+\b/)) return "number";

        // Addressing @
        if (stream.match(/^@/)) return "constant";

        // Segment names
        if (stream.match(/\b(Text_Segment|Data_Segment|Pool_Segment|Stack_Segment)\b/)) {
            return "string";
        }

        // Special functions
        if (stream.match(/\b(FOpen|FClose|Fread|Fgets|Fgetws|Fwrite|Fputs|Fputws|Fseek|Ftell|TextRead|TextWrite|BinaryRead|BinaryWrite|BinaryReadWrite|StdIn|StdOut|Halt)\b/)) {
            return "string";
        }

        // Strings
        if (stream.match(/^"/)) {
            while (!stream.eol()) {
                if (stream.next() === '"') break;
            }
            return "string";
        }

        // Consume any single character if no matches
        stream.next();
        return null;
    }
});


const setHighlightLine = StateEffect.define();
const lineHighlightDecoration = Decoration.line({
    attributes: { style: 'background-color: yellow' }
});
const lineHighlightField = StateField.define({
    create() {
        return Decoration.none;
    },
    update(lines, tr) {
        lines = lines.map(tr.changes);
        for (let e of tr.effects) if (e.is(setHighlightLine)) {
            if (e.value === null) {
                lines = Decoration.none;
            } else {
                lines = Decoration.set([lineHighlightDecoration.range(e.value)]);
            }
        }
        return lines;
    },
    provide: (f) => EditorView.decorations.from(f),
});

// Breakpoint
const breakpointEffect = StateEffect.define({
    map: (val, mapping) => ({ pos: mapping.mapPos(val.pos), on: val.on })
});

const breakpointState = StateField.define({
    create() { return RangeSet.empty },
    update(set, transaction) {
        set = set.map(transaction.changes)
        for (let e of transaction.effects) {
            if (e.is(breakpointEffect)) {
                if (e.value.on)
                    set = set.update({ add: [breakpointMarker.range(e.value.pos)] })
                else
                    set = set.update({ filter: from => from != e.value.pos })
            }
        }
        return set
    }
});

async function toggleBreakpoint(view, pos) {
    if (mmix_state.initialized === false) {
        console.log("MMIX is not initialized yet. Please compile first.");
        return;
    }
    const line = view.state.doc.lineAt(pos);
    console.log("Toggling breakpoint at line:", line.number);
    var cur_address = mmix_state.line_to_loc.get(line.number);
    if (cur_address === undefined) {
        console.log("No address found for the current line.");
        return;
    }
    let breakpoints = view.state.field(breakpointState)
    let hasBreakpoint = false;
    breakpoints.between(pos, pos, () => { hasBreakpoint = true })
    view.dispatch({
        effects: breakpointEffect.of({ pos, on: !hasBreakpoint })
    });

    if (hasBreakpoint) {
        await mmix_state.safe_send_command(`b${cur_address.toString(16)}\n`);
    } else {
        await mmix_state.safe_send_command(`bx${cur_address.toString(16)}\n`);
    }
}

const breakpointMarker = new class extends GutterMarker {
    toDOM() { return document.createTextNode("💔") }
}

const breakpointGutter = [
    breakpointState,
    gutter({
        class: "cm-breakpoint-gutter",
        markers: v => v.state.field(breakpointState),
        initialSpacer: () => breakpointMarker,
        domEventHandlers: {
            mousedown(view, line) {
                (async () => {
                    await toggleBreakpoint(view, line.from);
                })();
                return true
            }
        }
    }),
    EditorView.baseTheme({
        ".cm-breakpoint-gutter .cm-gutterElement": {
            color: "red",
            paddingLeft: "5px",
            cursor: "default"
        }
    })
]



let editor = new EditorView({
    doc: hello_world_src,
    parent: document.getElementById("editor-div"),
    extensions: [basicSetup, keymap.of([indentWithTab, defaultKeymap]), breakpointGutter, lineHighlightField, mmix_tokenizer],
});



let mmix_state = {
    initialized: false,
    mmix: undefined,
    loc_to_line: undefined,
    line_to_loc: undefined,
    next_command: undefined,
    capture_stdout: true,
    stdout_buffer: "",
    ready_for_next_action: false,

    init: async function (mmo_content) {
        let MMIX_Module = {
            preRun: () => {
                mmix_state.stderr_buffer = [];
                mmix_state.stdout_buffer = [];
                MMIX_Module.FS.init(null, stdout_fn, null);
            }
        }

        const mmix = await MMIX(MMIX_Module);
        this.mmix = mmix;
        this.loc_to_line = parse_mmo(mmo_content);
        this.line_to_loc = new Map();
        for (const [loc, line] of this.loc_to_line.entries()) {
            this.line_to_loc.set(line, loc);
        }
        this.next_command = undefined;
        this.capture_stdout = true;
        this.stdout_buffer = "";
        this.ready_for_next_action = true;
        mmix.FS.writeFile("./code.mmo", mmo_content, { encoding: "binary" });
        stdout_area.innerHTML = "Compiled Successfully. You can now execute step by step.\n";
        mmix.callMain(["-i", "./code.mmo"]);
        this.initialized = true;
    },

    send_command: function (cmd) {
        this.ready_for_next_action = false;
        this.next_command(cmd);
        this.next_command = () => {
            console.log("No input requested from MMIX interpreter. May be it is terminated?");
        };
    },

    safe_send_command: async function (cmd) {
        await this.pause_until_ready();
        this.send_command(cmd);
    },

    pause_until_ready: async function () {
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

    send_command_with_output: async function (cmd) {
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

    step: async function () {
        this.safe_send_command("\n");
        await this.maybe_set_hightlight();
    },

    continue: async function () {
        this.safe_send_command("c\n");
        await this.maybe_set_hightlight();
    },

    get_current_location: async function () {
        await this.pause_until_ready();
        const output = await this.send_command_with_output("s\n");
        const match = output.match(/now at location #([0-9A-Fa-f]+)/);

        if (match) {
            const addressBigInt = BigInt('0x' + match[1]);
            return this.loc_to_line.get(addressBigInt);
        } else {
            console.log("No address found in the line.");
            return undefined;
        }
    },

    maybe_set_hightlight: async function () {
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

    get_register: async function (register, format = "!") {
        const output = await this.send_command_with_output(`${register}${format}\n`);
        return output.split('=').pop().split('\n')[0];
    },

    get_memory: async function (start_address, count) {
        var output = await this.send_command_with_output(`M${start_address}#\n`);
        output = output.replace(/mmix> $/, '').trim() + "\n";
        const remaining = Math.ceil((count - 8) / 8);
        if (remaining > 0) {
            output += await this.send_command_with_output(`+${remaining}#\n`);
            output = output.replace(/mmix> $/, '').trim();
        }
        var result = [];
        for (const substring of output.split("\n")) {
            const octa = substring.split("=")[1].replace(/^#/, '');
            const octa_padded = "0".repeat(16 - octa.length) + octa
            for (let i = 0; i < 16; i += 2) {
                result.push(parseInt(`0x${octa_padded.slice(i, i + 2)}`));
            }
        }
        return result;
    },

    update_register_table: async function (change_visibility = true) {
        var format = "!";
        const format_select = document.getElementById("register-format");
        if (format_select.value === "#") {
            format = "#";
        }
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
        for (let i = 0; i < rL; i++) await update(this, `regr${i}`, `$${i}`);
        for (let i = rG; i <= 255; i++) await update(this, `regr${i}`, `$${i}`);
        for (let i = 65; i <= 90; i++) {
            const reg = String.fromCharCode(i);
            await update(this, "regr" + reg, `r${reg}`);
        }
        for (let reg of ['BB', 'TT', 'WW', 'XX', 'YY', 'ZZ']) {
            await update(this, "regr" + reg, `r${reg}`);
        }
    },

    update_memory_table: async function () {
        const start_address = document.getElementById("memory-address-start").value;
        const count = parseInt(document.getElementById("memory-address-count").value);
        if (!address_valid(start_address) || count <= 0) {
            console.log("Error parsing the start address!");
            return;
        }

        const bytes = await this.get_memory(start_address, count);
        const memory_table_tbody = document.getElementById("memory-table-body");
        memory_table_tbody.innerHTML = "";

        const format = document.getElementById("memory-format").value;
        const bytes_per_element = parseInt(document.getElementById("memory-bytes").value);

        for (let i = 0; i < bytes.length; i += 8) {
            const row = document.createElement("tr");
            const address = BigInt(`0x${start_address}`) + BigInt(i);
            const address_td = document.createElement("td");
            address_td.innerHTML = `#${address.toString(16).padStart(16, '0')}`;
            row.appendChild(address_td);

            var cell_content = "";
            // we always return 8 bytes per row, so no error checking
            for (let j = i; j < i + 8; j += bytes_per_element) {
                let value = 0;
                for (let k = 0; k < bytes_per_element; k++) {
                    value = (value << 8) | bytes[j + k];
                }
                if (format === "!") {
                    cell_content += " " + value.toString();
                } else if (format === "#") {
                    cell_content += " " + `#${value.toString(16).padStart(2 * bytes_per_element, '0')}`;
                }
            }
            const value_td = document.createElement("td");
            value_td.innerHTML = cell_content.trim();
            row.appendChild(value_td);
            memory_table_tbody.appendChild(row);
        }
    }
}

function address_valid(address) {
    return /^[0-9a-fA-F]+$/.test(address);
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
    alfs.writeFile("./code.mms", txt, { encoding: "ascii" });
    mmixal.callMain([`-b ${maxLength}`, "./code.mms"]);

    let content = alfs.readFile("./code.mmo", { encoding: "binary" });

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
let continue_btn = document.getElementById("continue-btn");

async function step_or_coninue(command) {
    if (mmix_state.mmix === undefined) {
        console.log("Please compile first");
    } else if (!mmix_state.ready_for_next_action) {
        console.log("Please hold while previous step is complete.")
    } else {
        step_btn.disabled = true;
        continue_btn.disabled = true;
        if (command === "step") {
            await mmix_state.step();
        } else if (command === "continue") {
            await mmix_state.continue();
        }
        await mmix_state.update_register_table(true);
        await mmix_state.update_memory_table();
        step_btn.disabled = false;
        continue_btn.disabled = false;
    }
}

step_btn.addEventListener("click", async (e) => {
    await step_or_coninue("step");
});

continue_btn.addEventListener("click", async (e) => {
    await step_or_coninue("continue");
});


function submit_command() {
    return new Promise((accept, reject) => {
        mmix_state.next_command = accept;
    });
}

function highlightLine(lineNo) {
    const docPosition = editor.state.doc.line(lineNo).from;
    editor.dispatch({ effects: setHighlightLine.of(docPosition) });
}

function removeHighlight() {
    editor.dispatch({ effects: setHighlightLine.of(null) });
}



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
        editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: text } });
        error_box.innerHTML = "";
        compileStep();
        dialog.close();
    } else {
        error_box.innerHTML = `Error loading file from GitHub: ${response.status} ${response.statusText}`;
    }
});

const resizeObserver = new ResizeObserver(() => {
    editor.requestMeasure();
});
const editorElement = document.getElementById('editor-div');
resizeObserver.observe(editorElement);

// Register management

const register_format_select = document.getElementById("register-format");
register_format_select.addEventListener("change", async (e) => {
    await mmix_state.update_register_table(false);
});

const add_register_btn = document.getElementById("add-register-btn");
add_register_btn.addEventListener("click", async (e) => {
    var register_name = document.getElementById("add-register").value.trim();
    if (register_name.match(/^r/))
        register_name = register_name.replace(/^r/, "");

    if (register_name) {
        const tr = document.getElementById("regr" + register_name);
        console.log(tr);
        if (tr) {
            tr.classList.remove("hidden-reg");
        }
    }
});

// Memory Management
const load_memory_btn = document.getElementById("load-memory-btn");
const memory_format_select = document.getElementById("memory-format");
const memory_bytes_select = document.getElementById("memory-bytes");
memory_format_select.addEventListener("change", async (e) => {
    await mmix_state.update_memory_table();
});
memory_bytes_select.addEventListener("change", async (e) => {
    await mmix_state.update_memory_table();
});
load_memory_btn.addEventListener("click", async (e) => {
    await mmix_state.update_memory_table();
});

const memory_address_cache = document.getElementById("memory-address-cache");
memory_address_cache.addEventListener("change", async (e) => {
    const selectedValue = memory_address_cache.value;
    memory_address_cache.options[memory_address_cache.selectedIndex].dataset.cacheHit += 1;
    document.getElementById("memory-address-start").value = selectedValue;
    await mmix_state.update_memory_table();
});

globalThis.editor = editor;
globalThis.mmix_state = mmix_state;
globalThis.submit_command = submit_command;