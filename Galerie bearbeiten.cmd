@echo off
rem Double-click entry point for the gallery editor. The real work happens in
rem cms\start-gallery.ps1 -- this wrapper exists because Windows opens a
rem double-clicked .ps1 in an editor instead of running it.
rem
rem -ExecutionPolicy Bypass applies to this one call only, it changes no
rem setting on the machine. Kept free of umlauts: a .cmd file is read in the
rem console's ANSI code page, where they would come out mangled.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0cms\start-gallery.ps1"
if errorlevel 1 pause
