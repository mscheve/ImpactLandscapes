#NoEnv  ; Recommended for performance and compatibility with future AutoHotkey releases.
; #Warn  ; Enable warnings to assist with detecting common errors.
SendMode Input  ; Recommended for new scripts due to its superior speed and reliability.
SetWorkingDir %A_ScriptDir%  ; Ensures a consistent starting directory.

MsgBox, Script has started: `n`n1. Fully collapse the contribution tree `n2. Select the first row `n3. Press space bar `n(press Esc to end script)

space::
InputBox, tresh, Treshold Specification, Input the treshold percentage `n`ne.g. 16.99 (max 2 places after decimal point)

Loop
{
	clipboard := ""  ; Start off empty to allow ClipWait to detect when the text has arrived.
	Send ^c ; Copy information of current selected entry 
	ClipWait  ; Wait for the clipboard to contain text.

	StartingPos := InStr(clipboard, "%") - 6
	cont := SubStr(clipboard, StartingPos, 6) ; Retrieve contribution percentage
	cont := LTrim(cont) ; Clean cont

	if cont >= %tresh% ; Check of currently selected entry is above treshold
	{
		Send, {right} ; Expand entry
	}
	Send, {down} ; Next entry
	Sleep, 5 ; Wait 5 milliseconds
}

Return

Esc::ExitApp ; Quit script