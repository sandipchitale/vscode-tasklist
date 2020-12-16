import * as vscode from 'vscode';

import { TasklistTextDocumentContentProvider } from './TasklistTextDocumentContentProvider';

export function activate({ subscriptions }: vscode.ExtensionContext) {
  // register a content provider for the cowsay-scheme
  const tasklistSchemeProvider = new TasklistTextDocumentContentProvider();

  subscriptions.push(tasklistSchemeProvider);
  subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider(
      TasklistTextDocumentContentProvider.TASKLIST,
      tasklistSchemeProvider
    )
  );

  // register a command that opens tasklist buffer
  subscriptions.push(
    vscode.commands.registerCommand(
      'vscode-tasklist',
      () => {
        tasklistSchemeProvider.open(TasklistTextDocumentContentProvider.TASKLIST);
      }
    )
  );

  subscriptions.push(
    vscode.commands.registerTextEditorCommand(
      'vscode-tasklist.sort-by-Image-Name',
      (editor) => {
        tasklistSchemeProvider.sortByImageName(editor);
      }
    )
  );

  subscriptions.push(
    vscode.commands.registerTextEditorCommand(
      'vscode-tasklist.sort-by-PID',
      (editor) => {
        tasklistSchemeProvider.sortByPID(editor);
      }
    )
  );

  subscriptions.push(
    vscode.commands.registerTextEditorCommand(
      'vscode-tasklist.sort-by-Memory-Usage',
      (editor) => {
        tasklistSchemeProvider.sortByMemoryUsage(editor);
      }
    )
  );

  subscriptions.push(
    vscode.commands.registerTextEditorCommand(
      'vscode-tasklist.sort-by-CPU-Time',
      (editor) => {
        tasklistSchemeProvider.sortByCPUTime(editor);
      }
    )
  );

  subscriptions.push(
    vscode.commands.registerTextEditorCommand(
      'vscode-tasklist.sort-by-Window-Title',
      (editor) => {
        tasklistSchemeProvider.sortByWindowTitle(editor);
      }
    )
  );

  subscriptions.push(
    vscode.commands.registerTextEditorCommand(
      'vscode-tasklist.kill-process',
      (editor) => {
        tasklistSchemeProvider.killProcess(editor);
      }
    )
  );

  subscriptions.push(
    vscode.commands.registerTextEditorCommand(
      'vscode-tasklist.reload',
      (editor) => {
        tasklistSchemeProvider.reload();
      }
    )
  );

  subscriptions.push(
    vscode.commands.registerTextEditorCommand(
      'vscode-tasklist.quit',
      (editor) => {
        tasklistSchemeProvider.quit();
      }
    )
  );
}
