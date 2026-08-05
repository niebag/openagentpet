# Keep Pet data local

The plugin and Companion app send no session data off the machine in v1. The Companion receives only an opaque local session identifier, display state, and a Pet label derived from the basename of the session's working directory; it never receives the full directory path, stores no transcripts, and includes no analytics or crash reporting. Explicit npm installation and confirmed updates, plus a user-triggered npm version check, are the only planned network operations.
