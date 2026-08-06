# Run the Companion on Windows

The Companion supports Windows 10 version 1809 and newer alongside macOS 13. Three platform assumptions had to be replaced, each behind a small abstraction rather than a branch at every call site.

The local control channel is a Unix-domain socket on macOS and a named pipe on Windows, where libuv has no filesystem sockets. Both are driven through the same `node:net` API, so only the endpoint string and its cleanup differ; `src/platform.ts` decides which. This weakens one guarantee: a Unix socket is protected by `0600` permissions, while Node cannot set an access-control list on a named pipe, so the Windows channel is reachable by other signed-in users of the same machine. The protocol accepts only the fixed payloads documented in the README, and the README states the difference.

Because a named pipe has no directory, the state directory is now an explicit option instead of `dirname(socketPath)`.

Pet pack validation no longer shells out to `/usr/bin/sips`. `src/gif.ts` walks the GIF block structure to answer the same two questions — does it decode, and does it have a transparent colour — on every platform and without a subprocess.

Window shape is held differently per platform. macOS expresses "square artwork above a fixed label row" as `setAspectRatio(1, { height: 24 })`; Windows ignores the extra size argument and would square the whole window, so there the shape is enforced from the `will-resize` event for whichever edge the user drags.
