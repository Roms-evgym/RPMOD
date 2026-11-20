# RPMOD Fabric client

Client-only Fabric mod for Minecraft Java 26.3.

## Toolchain
- Minecraft 26.3
- Java 25
- Fabric Loader 0.20.1
- Fabric API 0.166.0+26.3
- Fabric Loom 1.19-SNAPSHOT
- Gradle 9.9.1

Build with a Java 25 JDK and Gradle 9.9.1+: `gradle build`.

## Commands

- `/rp join <SHARECODE>` — downloads the project's manifest and ZIP into the active Minecraft instance.
- `/rp sync` — checks every locally joined project and downloads changed packs.
- `/rp leave <SHARECODE>` — removes that project's local pack and cached manifest.
- `/rp help` — prints the command list.

The mod writes its settings to `.minecraft/config/rpmod/config.properties`. Set `apiBase` to the public base URL of your RPMOD backend (without a trailing slash). The default is `http://localhost:8787`, intended only when the API is running on the same computer.

Downloaded ZIPs are saved in the current Minecraft instance's `resourcepacks/` folder as `RPMOD_<SHARECODE>.zip`. The mod automatically selects downloaded packs in Minecraft's resource-pack repository and reloads resources. If a pack changes later, run `/rp sync`; changed packs are downloaded and reactivated.

The current sync client verifies the share-code format, checks the manifest's SHA-256 pack hash, limits downloaded ZIPs to 64 MiB, writes to a temporary file and then replaces the previous ZIP.
