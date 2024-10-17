import {basicSetup} from "codemirror"
import {indentWithTab,defaultKeymap} from "@codemirror/commands"
import {EditorState} from "@codemirror/state"
import {EditorView, keymap} from "@codemirror/view"

import MMIXAL from "./mmixal.js"
import MMIX from "./mmix.js"
import {parse_mmo} from "./mmix_object_reader.mjs"

// preRun: function() {
// 	function stdin() {
// 	  if (i < res.length) {
// 		var code = input.charCodeAt(i);
// 		++i;
// 		return code;
// 	  } else {
// 		return null;
// 	  }
// 	}

// 	var stdoutBuffer = "";
// 	function stdout(code) {
// 	  if (code === "\n".charCodeAt(0) && stdoutBuffer !== "") {
// 		console.log(stdoutBuffer);
// 		stdoutBuffer = "";
// 	  } else {
// 		stdoutBuffer += String.fromCharCode(code);
// 	  }
// 	}


// 	}


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


let mmix_state = {
    initialized: false,
    mmix: undefined,
    loc_to_line: undefined,
    next_command: undefined,

    step: function() {
        this.next_command("\n");
        this.next_command = () => {
            console.log("No input requested from MMIX interpreter. May be it is terminated?");
        };
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



document.getElementById("compile-btn").addEventListener("click", (e) => {
    compile().then((mmo_content) => {

        let MMIX_Module = {
            preRun: () => {
                mmix_state.stderr_buffer = [];
                mmix_state.stdout_buffer = [];
                MMIX_Module.FS.init(null, null, null);
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