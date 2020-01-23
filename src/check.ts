import * as ts from 'typescript';
import * as path from 'path';

export default function check(file: string): string {
     const   errors: Map<string,number> = new Map<string, number>();
     errors.set("@ts-ignore",0);
     errors.set("module.exports",0);

    const program = ts.createProgram([file], { allowJs: false });
    const sourceFiles = program.getSourceFiles().filter(sf => path.normalize(sf.fileName) === path.normalize(file));
    const sourceFile = sourceFiles[0];
    let foundCount = 0;
    function myVisitor(node: ts.Node) {
        if (ts.isJsxText(node) && node.text.indexOf('@ts-ignore') >= 0) {
            errors.set("@ts-ignore",errors.get("@ts-ignore")!+1);
            foundCount++;
        }

        if(ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression) && node.expression.text==='module' && ts.isIdentifier(node.name) && node.name.text==='exports' ){
            errors.set("module.exports",errors.get("module.exports")!+1);
        }

        node.forEachChild(myVisitor);
    }
    sourceFile!.forEachChild(myVisitor);

    let errorDesc = "";
    errors.forEach((value, key) => {
        if(value>0){
            errorDesc+=`'${key}' error ,count: ${value}`;
        }
    });
    return errorDesc;
}
