#ifdef EMSCRIPTEN
#include <emscripten.h>
#include <string.h>

// Thanks! @gaycodegal for https://github.com/gaycodegal/lua-repl/blob/main/term/io.cc
EM_ASYNC_JS(char *, read_command_js, (), {
  const response = await submit_command();
  const byteCount = (Module.lengthBytesUTF8(response) + 1);

  const linePointer = Module._malloc(byteCount);
  Module.stringToUTF8(response, linePointer, byteCount);

  return linePointer;
});

void read_command(char* command_buf, int size) {
    char *line = read_command_js();
    strncpy(command_buf, line, size-1);
    command_buf[size-1] = 0;
    free(line);
}

#endif