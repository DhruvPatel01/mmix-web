function read_u32(bytes, i) {
    return BigInt((bytes[i] << 24) | (bytes[i + 1] << 16) | (bytes[i + 2] << 8) | (bytes[i + 3]))
}

function read_u64(bytes, i) {
    let left = read_u32(bytes, i);
    return (left << BigInt(32)) | read_u32(bytes, i + 4);
}



export function parse_mmo(bytes) {
    let cur_line = 0;
    let i = 0;
    let running_spec = -1;
    let quote = false;
    let cur_address = BigInt(0);
    let do_track = true;
    let loc_to_line = new Map();

    while (i < bytes.length) {
        if (bytes[i] == 152 && !quote) {
            if (running_spec >= 0)
                running_spec = -1;

            switch (bytes[i + 1]) {
                case 0:
                    quote = true;
                    i += 4;
                    break;

                case 1: {
                    let Y = bytes[i + 2];
                    const Z = bytes[i + 3];
                    do_track = Y > 0 ? false : true;
                    Y = BigInt(Y) << BigInt(56);

                    if (Z == 1) {
                        cur_address = Y + read_u32(bytes, i + 4);
                        i += 8;
                    } else {
                        cur_address = Y + read_u64(bytes, i + 4);
                        do_track =  (cur_address >>> BigInt(56)) !== BigInt(0)
                        i += 12;
                    }
                };
                    break;

                case 2: {
                    const YZ = BigInt(bytes[i + 2] << 8 | bytes[i + 3]);
                    cur_address += YZ;
                    i += 4;
                }
                    break;

                case 3: {
                    const Z = bytes[i + 3];
                    i += (Z + 1) << 2;
                }
                    break;

                case 4:
                    i += 4;
                    break;

                case 5:
                    i += 4;
                    break;

                case 6: {
                    let Z = bytes[i + 3];
                    cur_line = 0;
                    i += (Z + 1) << 2;
                }
                    break;

                case 7: {
                    const YZ = bytes[i + 2] << 8 | bytes[i + 3];
                    cur_line = YZ;
                    i += 4;
                }
                    break;

                case 8: {
                    const YZ = bytes[i + 2] << 8 | bytes[i + 3];
                    running_spec = YZ;
                    i += 4;
                }
                    break;

                case 9: { //lop_pre Y==1, Z==number of tetras
                    const Z = bytes[i + 3];
                    i += (Z + 1) << 2;
                }
                    break;
                case 10:
                    console.log("encountered lop_post. Skipping remaining things...");
                    return loc_to_line;
            }
        } else {
            if (running_spec < 0 & do_track) { //Not  Special section 
                loc_to_line[cur_address] = cur_line;
                // console.log("Current address: ", cur_address.toString(16));
                // console.log("Instruction OPCODE: ", bytes[i]);
                // console.log("Current line number: ", cur_line);
                // console.log("\n\n");
                cur_line += 1;
                cur_address += BigInt(4);

            }
            if (quote) {
                quote = false;
            }
            i += 4;
        }
    }

    return loc_to_line;

}
