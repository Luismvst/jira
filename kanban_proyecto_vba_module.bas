
Attribute VB_Name = "modProyectoKanban"
Option Explicit

Private Const SHEET_BACKLOG As String = "Backlog"
Private Const SHEET_SEG As String = "Seguimiento"
Private Const SHEET_COMP As String = "Completadas"
Private Const SHEET_CREATOR As String = "Creador_Tareas"

Public Sub RefrescarVistas()
    Dim wsB As Worksheet, wsS As Worksheet, wsC As Worksheet
    Dim lastB As Long, r As Long, nextS As Long, nextC As Long

    Set wsB = ThisWorkbook.Worksheets(SHEET_BACKLOG)
    Set wsS = ThisWorkbook.Worksheets(SHEET_SEG)
    Set wsC = ThisWorkbook.Worksheets(SHEET_COMP)

    Application.ScreenUpdating = False

    ClearBody wsS, 6
    ClearBody wsC, 6

    lastB = wsB.Cells(wsB.Rows.Count, "A").End(xlUp).Row
    nextS = 6
    nextC = 6

    For r = 2 To lastB
        If Trim(wsB.Cells(r, "A").Value) <> "" Then
            If wsB.Cells(r, "L").Value = "Completada" Then
                CopyRow wsB, r, wsC, nextC
                nextC = nextC + 1
            ElseIf wsB.Cells(r, "M").Value = "Sí" Then
                CopyRow wsB, r, wsS, nextS
                nextS = nextS + 1
            End If
        End If
    Next r

    Application.ScreenUpdating = True
    MsgBox "Vistas regeneradas correctamente.", vbInformation
End Sub

Public Sub EnviarSeleccionASeguimiento()
    Dim ws As Worksheet, rowNum As Long
    Set ws = ActiveSheet
    If ws.Name <> SHEET_BACKLOG Then
        MsgBox "Selecciona una fila en la hoja Backlog.", vbExclamation
        Exit Sub
    End If

    rowNum = ActiveCell.Row
    If rowNum < 2 Then
        MsgBox "Selecciona una fila válida.", vbExclamation
        Exit Sub
    End If

    If Not ValidarFilaBacklog(ws, rowNum) Then Exit Sub

    MarcarSeguimiento ws, rowNum, True

    Select Case ws.Cells(rowNum, "C").Value
        Case "Epic"
            If MsgBox("¿Quieres incluir todos los hijos de esta épica en Seguimiento?", vbYesNo + vbQuestion) = vbYes Then
                IncluirDescendientes ws, ws.Cells(rowNum, "A").Value
            End If
        Case "Topic"
            If MsgBox("¿Quieres incluir las tareas y subtareas de este topic en Seguimiento?", vbYesNo + vbQuestion) = vbYes Then
                IncluirDescendientes ws, ws.Cells(rowNum, "A").Value
            End If
        Case "Tarea"
            If MsgBox("¿Quieres incluir las subtareas de esta tarea en Seguimiento?", vbYesNo + vbQuestion) = vbYes Then
                IncluirDescendientes ws, ws.Cells(rowNum, "A").Value
            End If
    End Select

    RefrescarVistas
End Sub

Public Sub MoverSeleccionACompletadas()
    Dim ws As Worksheet, rowNum As Long
    Set ws = ActiveSheet

    If ws.Name <> SHEET_BACKLOG And ws.Name <> SHEET_SEG Then
        MsgBox "Selecciona una fila en Backlog o Seguimiento.", vbExclamation
        Exit Sub
    End If

    rowNum = ActiveCell.Row
    If rowNum < 2 Then rowNum = ActiveCell.Row
    If ws.Name = SHEET_SEG And rowNum < 6 Then
        MsgBox "Selecciona una fila válida de Seguimiento.", vbExclamation
        Exit Sub
    End If

    If ws.Name = SHEET_SEG Then
        Dim idValue As String
        idValue = ws.Cells(rowNum, "A").Value
        rowNum = FindRowById(ThisWorkbook.Worksheets(SHEET_BACKLOG), idValue)
        If rowNum = 0 Then
            MsgBox "No se encontró la fila original en Backlog.", vbCritical
            Exit Sub
        End If
        Set ws = ThisWorkbook.Worksheets(SHEET_BACKLOG)
    End If

    ws.Cells(rowNum, "L").Value = "Completada"
    ws.Cells(rowNum, "U").Value = Date
    ws.Cells(rowNum, "M").Value = "No"

    RefrescarVistas
End Sub

Public Sub CrearTareasDesdeCSV()
    Dim wsB As Worksheet, wsC As Worksheet
    Dim lastB As Long, nextRow As Long, r As Long, lineText As String
    Dim arr() As String, newId As String

    Set wsB = ThisWorkbook.Worksheets(SHEET_BACKLOG)
    Set wsC = ThisWorkbook.Worksheets(SHEET_CREATOR)

    lastB = wsB.Cells(wsB.Rows.Count, "A").End(xlUp).Row

    For r = 12 To wsC.Cells(wsC.Rows.Count, "D").End(xlUp).Row
        lineText = Trim(wsC.Cells(r, "D").Value)
        If lineText <> "" Then
            arr = Split(lineText, ",")
            If UBound(arr) >= 12 Then
                nextRow = wsB.Cells(wsB.Rows.Count, "A").End(xlUp).Row + 1
                newId = GenerarId(wsB, Trim(arr(0)))

                wsB.Cells(nextRow, "A").Value = newId
                wsB.Cells(nextRow, "B").Value = Trim(arr(1))
                wsB.Cells(nextRow, "C").Value = Trim(arr(0))
                wsB.Cells(nextRow, "E").Value = Trim(arr(2))
                wsB.Cells(nextRow, "F").Value = Trim(arr(3))
                wsB.Cells(nextRow, "G").Value = Trim(arr(4))
                wsB.Cells(nextRow, "H").Value = Trim(arr(5))
                wsB.Cells(nextRow, "I").Value = Trim(arr(6))
                wsB.Cells(nextRow, "J").Value = Trim(arr(7))
                wsB.Cells(nextRow, "K").Value = Trim(arr(8))
                wsB.Cells(nextRow, "L").Value = "Backlog"
                wsB.Cells(nextRow, "M").Value = "No"
                wsB.Cells(nextRow, "N").Value = Trim(arr(11))
                wsB.Cells(nextRow, "O").Value = Trim(arr(10))
                wsB.Cells(nextRow, "R").Value = Date
                wsB.Cells(nextRow, "S").Value = Trim(arr(9))
                wsB.Cells(nextRow, "X").Value = Trim(arr(12))
            End If
        End If
    Next r

    MsgBox "Carga CSV completada. Revisa las filas insertadas en Backlog.", vbInformation
End Sub

Public Sub CrearTareaIndividual()
    Dim wsB As Worksheet, wsC As Worksheet, nextRow As Long, nivel As String

    Set wsB = ThisWorkbook.Worksheets(SHEET_BACKLOG)
    Set wsC = ThisWorkbook.Worksheets(SHEET_CREATOR)

    nivel = Trim(wsC.Range("B4").Value)
    If nivel = "" Or Trim(wsC.Range("B10").Value) = "" Or Trim(wsC.Range("B11").Value) = "" Or Trim(wsC.Range("B12").Value) = "" Then
        MsgBox "Faltan campos obligatorios en el alta individual.", vbExclamation
        Exit Sub
    End If

    nextRow = wsB.Cells(wsB.Rows.Count, "A").End(xlUp).Row + 1

    wsB.Cells(nextRow, "A").Value = GenerarId(wsB, nivel)
    wsB.Cells(nextRow, "B").Value = wsC.Range("B5").Value
    wsB.Cells(nextRow, "C").Value = nivel
    wsB.Cells(nextRow, "E").Value = wsC.Range("B6").Value
    wsB.Cells(nextRow, "F").Value = wsC.Range("B7").Value
    wsB.Cells(nextRow, "G").Value = wsC.Range("B8").Value
    wsB.Cells(nextRow, "H").Value = wsC.Range("B9").Value
    wsB.Cells(nextRow, "I").Value = wsC.Range("B10").Value
    wsB.Cells(nextRow, "J").Value = wsC.Range("B11").Value
    wsB.Cells(nextRow, "K").Value = wsC.Range("B12").Value
    wsB.Cells(nextRow, "L").Value = "Backlog"
    wsB.Cells(nextRow, "M").Value = "No"
    wsB.Cells(nextRow, "N").Value = wsC.Range("B15").Value
    wsB.Cells(nextRow, "O").Value = wsC.Range("B14").Value
    wsB.Cells(nextRow, "R").Value = Date
    wsB.Cells(nextRow, "S").Value = wsC.Range("B13").Value
    wsB.Cells(nextRow, "X").Value = wsC.Range("B16").Value

    MsgBox "Tarea creada correctamente.", vbInformation
End Sub

Public Sub LimpiarSeguimientoAntiguo()
    Dim wsB As Worksheet, lastB As Long, r As Long
    Set wsB = ThisWorkbook.Worksheets(SHEET_BACKLOG)
    lastB = wsB.Cells(wsB.Rows.Count, "A").End(xlUp).Row

    For r = 2 To lastB
        If wsB.Cells(r, "L").Value = "Completada" And IsDate(wsB.Cells(r, "U").Value) Then
            If DateDiff("d", wsB.Cells(r, "U").Value, Date) > 30 Then
                wsB.Cells(r, "M").Value = "No"
            End If
        End If
    Next r

    RefrescarVistas
End Sub

Private Function ValidarFilaBacklog(ws As Worksheet, rowNum As Long) As Boolean
    ValidarFilaBacklog = False

    If Trim(ws.Cells(rowNum, "A").Value) = "" Then
        MsgBox "Falta ID.", vbExclamation: Exit Function
    End If
    If Trim(ws.Cells(rowNum, "C").Value) = "" Then
        MsgBox "Falta Nivel.", vbExclamation: Exit Function
    End If
    If Trim(ws.Cells(rowNum, "E").Value) = "" Then
        MsgBox "Falta Épica.", vbExclamation: Exit Function
    End If
    If Trim(ws.Cells(rowNum, "I").Value) = "" Then
        MsgBox "Falta Resumen.", vbExclamation: Exit Function
    End If
    If Trim(ws.Cells(rowNum, "J").Value) = "" Then
        MsgBox "Falta Responsable.", vbExclamation: Exit Function
    End If
    If Trim(ws.Cells(rowNum, "K").Value) = "" Then
        MsgBox "Falta Prioridad.", vbExclamation: Exit Function
    End If
    If Trim(ws.Cells(rowNum, "N").Value) <> "Sí" Then
        MsgBox "No puedes pasar la fila a Seguimiento: Definición_OK debe ser Sí.", vbExclamation
        Exit Function
    End If

    ValidarFilaBacklog = True
End Function

Private Sub MarcarSeguimiento(ws As Worksheet, rowNum As Long, ByVal valueFlag As Boolean)
    ws.Cells(rowNum, "M").Value = IIf(valueFlag, "Sí", "No")
    If valueFlag Then
        ws.Range("M" & rowNum & ":X" & rowNum).Interior.Color = RGB(217, 217, 217)
    Else
        ws.Range("M" & rowNum & ":X" & rowNum).Interior.Pattern = xlNone
    End If
End Sub

Private Sub IncluirDescendientes(ws As Worksheet, parentId As String)
    Dim lastB As Long, r As Long
    lastB = ws.Cells(ws.Rows.Count, "A").End(xlUp).Row

    For r = 2 To lastB
        If ws.Cells(r, "B").Value = parentId Then
            If ValidarFilaBacklog(ws, r) Then
                MarcarSeguimiento ws, r, True
                IncluirDescendientes ws, ws.Cells(r, "A").Value
            End If
        End If
    Next r
End Sub

Private Sub ClearBody(ws As Worksheet, firstDataRow As Long)
    Dim lastRow As Long
    lastRow = ws.Cells(ws.Rows.Count, "A").End(xlUp).Row
    If lastRow >= firstDataRow Then
        ws.Rows(firstDataRow & ":" & lastRow).ClearContents
    End If
End Sub

Private Sub CopyRow(wsFrom As Worksheet, rowFrom As Long, wsTo As Worksheet, rowTo As Long)
    wsFrom.Range("A" & rowFrom & ":X" & rowFrom).Copy
    wsTo.Range("A" & rowTo).PasteSpecial xlPasteValues
    Application.CutCopyMode = False
End Sub

Private Function FindRowById(ws As Worksheet, idValue As String) As Long
    Dim lastB As Long, r As Long
    lastB = ws.Cells(ws.Rows.Count, "A").End(xlUp).Row
    For r = 2 To lastB
        If ws.Cells(r, "A").Value = idValue Then
            FindRowById = r
            Exit Function
        End If
    Next r
    FindRowById = 0
End Function

Private Function GenerarId(ws As Worksheet, nivel As String) As String
    Dim prefix As String, maxNum As Long, lastB As Long, r As Long, rawId As String, numPart As Long

    Select Case UCase(Trim(nivel))
        Case "EPIC": prefix = "EP-"
        Case "TOPIC": prefix = "TP-"
        Case "TAREA": prefix = "TK-"
        Case Else: prefix = "ST-"
    End Select

    lastB = ws.Cells(ws.Rows.Count, "A").End(xlUp).Row
    maxNum = 0

    For r = 2 To lastB
        rawId = Trim(ws.Cells(r, "A").Value)
        If Left(rawId, Len(prefix)) = prefix Then
            numPart = Val(Mid(rawId, Len(prefix) + 1))
            If numPart > maxNum Then maxNum = numPart
        End If
    Next r

    GenerarId = prefix & Format(maxNum + 1, "000")
End Function
