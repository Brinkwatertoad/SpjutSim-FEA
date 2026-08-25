# Generated local runtime

`*-worker-source.js` files package the readable sources in `/workers` as JavaScript
strings. The application turns those strings into Blob URLs so workers can start
when `web/index.html` is opened through `file://`.

Regenerate after changing a worker source:

```sh
python3 tools/build-local-runtime.py
```

The generator verifies the worker protocol version and writes source checksums into
each artifact header. Generated files are checked in so normal browser-source work
does not require a build step.
