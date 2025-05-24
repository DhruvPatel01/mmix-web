@x
#include <stdio.h>
#include <stdlib.h>
@y
#include <stdio.h>
#include <stdlib.h>

#ifdef EMSCRIPTEN
void read_command(char* command_buf, int size);
#endif
@z


@x
    if (!fgets(command_buf,command_buf_size,stdin)) command_buf[0]='q';
@y
#ifdef EMSCRIPTEN
read_command(command_buf, command_buf_size);
#else
    if (!fgets(command_buf,command_buf_size,stdin)) command_buf[0]='q';
#endif
@z




