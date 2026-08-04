# Use a Unix-domain socket for local control

The plugin sends fixed Pet lifecycle and Activity state commands to the Companion through a Unix-domain socket. This keeps control local to the macOS user and avoids exposing a localhost TCP service in v1.
