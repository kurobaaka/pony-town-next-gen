@echo off
cd /d "D:\-0644\Other Desktop\23\pony-town-next-gen"
start cmd /k "npm run wds"
start cmd /k "npm run ts-watch"
start cmd /k "gulp test"
start cmd /k "gulp dev --sprites"
