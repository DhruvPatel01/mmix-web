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
    stdout_buffer: [],
    stderr_buffer: [],
    loc_to_line: undefined,
    next: false,

    step: function() {
        console.log("Hello there!");
        // Send command to mmix

        // capture the output
    },

    stdout: function(c) {
        console.log(String.fromCharCode(c));
        this.stdout_buffer.push(c);
        console.log(String.fromCharCode(c));

        console.log(String.fromCharCode(c), "=>", this.stdout_buffer.join(""));
        // if (c == 10) {
        //     console.log("Std Out Line: ", this.stdout_buffer.join(""));
        //     this.stdout_buffer.length = 0;
        // }
    },

    stderr: function(c) {
        this.stderr_buffer.push(c);
        if (c == 10) {
            console.log("Std Err Line: ", this.stderr_buffer.join(""));
            this.stderr_buffer.length = 0;
        }

    },

    stdin: function() { 
        console.log("Called stdin")
        if (this.next) {
            this.next = false;
            return 10;
        } else {
            return null;
        }
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
                // MMIX_Module.FS.init(mmix_state.stdin, mmix_state.stdout, mmix_state.stderr);
                MMIX_Module.FS.init(mmix_state.stdin, null, null);
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


document.getElementById("step-btn").addEventListener("click", (e) => {
    if (mmix_state.mmix === undefined) {
        console.log("Please compile first");
    } else {
        mmix_state.next = true;
    }
});


function submit_command() {
    return new Promise((accept, reject)=>{
	    accept(command + "\n");
    });
}

globalThis.editor = editor;
globalThis.mmix_state = mmix_state;
globalThis.submit_command = submit_command;