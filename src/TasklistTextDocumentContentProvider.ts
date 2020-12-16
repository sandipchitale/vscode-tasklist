import * as vscode from "vscode";
import { TextDocument, TextEditor } from 'vscode';
import * as child_process from 'child_process';

const HEADER_LINES = 3;
const FOOTER_LINES = 1;

const Image_Name_COLUMNS: [number, number] = [0, 25];
const PID_COLUMNS: [number, number] = [27, 34];
const Mem_Usage_COLUMNS: [number, number] = [64, 76];
const CPU_Time_COLUMNS: [number, number] = [144, 156];
const Window_Title_COLUMNS: [number, number] = [157, 230];

enum SORT_BY {
  Image_Name
  ,PID
  ,Mem_Usage
  ,CPU_Time
  ,Window_Title
}

enum SORT_DIRECTION {
  ASC,
  DESC
}

function substringSortFn(from: number, to: number, direction: SORT_DIRECTION = SORT_DIRECTION.ASC) {
  return function(a: string, b: string) {
    if (direction === SORT_DIRECTION.ASC) {
      return a.substring(from, to).localeCompare(b.substring(from, to));
    } else {
      return b.substring(from, to).localeCompare(a.substring(from, to));
    }
  };
}

const sortByImageName = substringSortFn(...Image_Name_COLUMNS);
const sortByPID = substringSortFn(...PID_COLUMNS);
const sortByMemoryUsage = substringSortFn(...Mem_Usage_COLUMNS, SORT_DIRECTION.DESC);
const sortByCPUTime =  substringSortFn(...CPU_Time_COLUMNS, SORT_DIRECTION.DESC);
const sortByWindowTitle = substringSortFn(...Window_Title_COLUMNS);

export class TasklistTextDocumentContentProvider implements vscode.TextDocumentContentProvider {
  static readonly TASKLIST = 'tasklist';

  // emitter and its event
  onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>();
  onDidChange = this.onDidChangeEmitter.event;

  private uri: vscode.Uri | undefined = undefined;

  private tasklistTextDocument: undefined | TextDocument;
  private tasklistTextEditor: undefined | TextEditor;

  private rawTasklistBuffer = '';

  private sortBy: SORT_BY = SORT_BY.Image_Name;

  private sortByFunction = sortByImageName;
  private invertSortByFunction = false;

  constructor() {
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor && editor.document.uri.scheme === TasklistTextDocumentContentProvider.TASKLIST) {
        editor.options = {
          cursorStyle: vscode.TextEditorCursorStyle.BlockOutline,
        };
        vscode.commands.executeCommand('setContext', 'vscode-tasklist', true);
        // Force reload on focus gain
        this.reload();
      } else {
        vscode.commands.executeCommand('setContext', 'vscode-tasklist', false);
      }
    });
  }

  provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
    return this.buffer(uri);
  }

  dispose(): any {
    this.tasklistTextDocument = undefined;
    this.tasklistTextEditor = undefined;

    this.onDidChangeEmitter.dispose();
  }

  buffer(uri: vscode.Uri) : Promise<string> {
    this.uri = uri;
    return new Promise((resolve, reject) => {
      if (this.rawTasklistBuffer.length === 0) {
        vscode.commands.executeCommand('setContext', 'vscode-tasklist-updating', true);
        const dirProcess = child_process.spawn(
          'cmd',
          [
            '/C'
            ,'tasklist'
            ,'/V'
          ]
        );

        dirProcess.stdout.on('data', (data) => {
          this.rawTasklistBuffer += data;
        });

        dirProcess.stderr.on('data', (data) => {
          console.error(`stderr: ${data}`);
          reject(data);
        });

        dirProcess.on('exit', (code) => {
          vscode.commands.executeCommand('setContext', 'vscode-tasklist-updating', false);
          this.rawTasklistBuffer = this.rawTasklistBuffer.split('\r\n').join('\n');
          resolve(this._processedTasklistBuffer(this.rawTasklistBuffer));
        });
      } else {
        resolve(this._processedTasklistBuffer(this.rawTasklistBuffer));
      }
    });
  }

  private _processedTasklistBuffer(rawTasklistBuffer: string): string {
    let tasklistBufferLines = rawTasklistBuffer.split('\n');

    tasklistBufferLines[0] = 'k - Kill process, Toggle Sort By: i - Image Name, p - PID, m - Memory Usage, c - CPU Time, w - Window Title';
    tasklistBufferLines = tasklistBufferLines.filter((tasklistBufferLine, index) => {
      return (
        (index < 2 && index > (tasklistBufferLines.length - 2)) ||
        (!tasklistBufferLine.startsWith('svchost.exe')));
    });

    tasklistBufferLines.forEach((tasklistBufferLine, index) => {
      tasklistBufferLines[index] = tasklistBufferLines[index].trim();
    });

    const tasklistBufferLinesFooter = tasklistBufferLines.splice(tasklistBufferLines.length - 1, tasklistBufferLines.length);
    const tasklistBufferLinesForSort = tasklistBufferLines.splice(3, tasklistBufferLines.length);

    tasklistBufferLinesForSort.sort(this.sortByFunction);
    if (this.invertSortByFunction) {
      tasklistBufferLinesForSort.reverse();
    }

    tasklistBufferLines =[
      ...tasklistBufferLines,
      ...tasklistBufferLinesForSort,
      ...tasklistBufferLinesFooter
    ];

    return tasklistBufferLines.join('\n') + '\n';
  }

  open(dir: string) {
    this.rawTasklistBuffer = '';
    if (this.tasklistTextDocument) {
      vscode.window.showTextDocument(this.tasklistTextDocument, { preview: false }).then(() => {
        vscode.commands.executeCommand("workbench.action.closeActiveEditor").then(async () => {
          this._open(dir);
        });
      });
    } else {
      this._open(dir);
    }
  }

  async _open(dir: string) {
    const uri = vscode.Uri.parse(`${TasklistTextDocumentContentProvider.TASKLIST}:///${ dir }`);
    this.tasklistTextDocument = await vscode.workspace.openTextDocument(uri);
    vscode.languages.setTextDocumentLanguage(this.tasklistTextDocument, TasklistTextDocumentContentProvider.TASKLIST);
    this.tasklistTextEditor = await vscode.window.showTextDocument(this.tasklistTextDocument, { preview: false });
    this.tasklistTextEditor.options.insertSpaces = false;
    this.tasklistTextEditor.options.tabSize = 0;
    this._goto(HEADER_LINES);
  }

  sortByImageName(editor: TextEditor) {
    if (this.sortByFunction === sortByImageName) {
      this.invertSortByFunction = !this.invertSortByFunction;
    } else {
      this.invertSortByFunction = false;
    }
    this.sortByFunction = sortByImageName;
    this.refresh();
  }

  sortByPID(editor: TextEditor) {
    if (this.sortByFunction === sortByPID) {
      this.invertSortByFunction = !this.invertSortByFunction;
    } else {
      this.invertSortByFunction = false;
    }
    this.sortByFunction = sortByPID;
    this.refresh();
  }

  sortByMemoryUsage(editor: TextEditor) {
    if (this.sortByFunction === sortByMemoryUsage) {
      this.invertSortByFunction = !this.invertSortByFunction;
    } else {
      this.invertSortByFunction = false;
    }
    this.sortByFunction = sortByMemoryUsage;
    this.refresh();
  }

  sortByCPUTime(editor: TextEditor) {
    if (this.sortByFunction === sortByCPUTime) {
      this.invertSortByFunction = !this.invertSortByFunction;
    } else {
      this.invertSortByFunction = false;
    }
    this.sortByFunction = sortByCPUTime;
    this.refresh();
  }

  sortByWindowTitle(editor: TextEditor) {
    if (this.sortByFunction === sortByWindowTitle) {
      this.invertSortByFunction = !this.invertSortByFunction;
    } else {
      this.invertSortByFunction = false;
    }
    this.sortByFunction = sortByWindowTitle;
    this.refresh();
  }

  killProcess(editor: TextEditor) {
    this.tasklistTextEditor = editor;
    this.tasklistTextDocument = this.tasklistTextEditor.document;

    const lineNumber =  this.tasklistTextEditor.selection.start.line;
    const lineCount = this.tasklistTextDocument.lineCount;
    if (lineNumber >= HEADER_LINES && lineNumber < lineCount - FOOTER_LINES) {
      const lineText = this.tasklistTextDocument.lineAt(lineNumber);
      const processId = +lineText!.text.substring(...PID_COLUMNS);
      if (processId > 0) {
        vscode.window.showInformationMessage(`Kill process id: ${processId}`, 'No', 'Yes').then(response => {
          if (response === 'Yes') {
            const dirProcess = child_process.spawn(
              'cmd',
              [
                '/C'
                ,'taskkill'
                ,'/F'
                ,'/PID'
                ,`${processId}`
              ]
            );
            dirProcess.on('exit', (code) => {
              console.error(`taskkill exited with code: ${code}`);
              this.reload();
            });
          }
        });
      }
    }
  }

  private _goto(lineNumber: number) {
    this.tasklistTextEditor!.selection = new vscode.Selection(lineNumber, PID_COLUMNS[1] - 1, lineNumber, PID_COLUMNS[1] - 1);
  }

  reload() {
    this.rawTasklistBuffer = '';
    this.refresh();
  }

  refresh() {
    this.onDidChangeEmitter.fire(this.uri);
  }

  quit() {
    vscode.commands.executeCommand("workbench.action.closeActiveEditor");
  }

}
