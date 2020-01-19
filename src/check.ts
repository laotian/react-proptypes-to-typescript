import * as ts from 'typescript';
import * as path from 'path';

export default function check(file: string): number {
    const program = ts.createProgram([file], { allowJs: false });
    const sourceFiles = program.getSourceFiles().filter(sf => path.normalize(sf.fileName) === path.normalize(file));
    const sourceFile = sourceFiles[0];
    let foundCount = 0;
    function myVisitor(node: ts.Node) {
        if (ts.isJsxText(node) && node.text.indexOf('@ts-ignore') >= 0) {
            foundCount++;
        }
        node.forEachChild(myVisitor);
    }
    sourceFile!.forEachChild(myVisitor);
    return foundCount;
}
