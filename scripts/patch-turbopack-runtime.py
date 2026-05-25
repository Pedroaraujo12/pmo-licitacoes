#!/usr/bin/env python3
"""Post-build script to patch the Turbopack runtime for static export compatibility."""
import glob, os, re, subprocess

OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'out')

def patch_runtime():
    chunks_dir = os.path.join(OUT_DIR, '_next', 'static', 'chunks')
    if not os.path.isdir(chunks_dir):
        print(f"ERROR: chunks directory not found at {chunks_dir}")
        return False

    runtime_files = glob.glob(os.path.join(chunks_dir, 'turbopack-*.js'))
    if not runtime_files:
        print("ERROR: no turbopack runtime file found")
        return False

    runtime_file = runtime_files[0]
    print(f"Patching: {os.path.basename(runtime_file)}")

    with open(runtime_file) as f:
        content = f.read()

    content = content.replace(
        'throw Error("chunk path empty but not in a worker")',
        'return { src: "" }'
    )
    content = content.replace(
        'decodeURIComponent(e.src.replace(/[?#].*$/,""))',
        'decodeURIComponent((null==e?"":e.src).replace(/[?#].*$/,""))'
    )
    content = content.replace(
        'D("string"==typeof e?q(e):e.src).resolve()',
        'D("string"==typeof e?q(e):null==e?"":e.src).resolve()'
    )
    content = content.replace(
        'L(t)&&r.resolve()',
        '(L(t)||N(t))&&r.resolve()'
    )
    old5 = 'if(await Promise.all(r.otherChunks.map(e=>T(i.Runtime,n,e))),r.runtimeModuleIds.length>0)for(let e of r.runtimeModuleIds)!function(e,t){let r=I[t];if(r){if(r.error)throw r.error;return}W(t,i.Runtime,e)}(n,e)'
    new5 = 'if(r.runtimeModuleIds.length>0)!function(e,t){function r(n){if(n>=t.length)return;var o=t[n];try{W(o,i.Runtime,e),r(n+1)}catch(a){setTimeout(function(){r(n)},100)}}r(0)}(n,r.runtimeModuleIds)'
    content = content.replace(old5, new5)

    with open(runtime_file, 'w') as f:
        f.write(content)

    result = subprocess.run(['node', '--check', runtime_file], capture_output=True, text=True, timeout=5)
    if result.returncode == 0:
        print("JavaScript syntax check PASSED")
        return True
    else:
        print(f"Syntax check FAILED: {result.stderr[:200]}")
        return False

if __name__ == '__main__':
    patch_runtime()
