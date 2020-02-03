import * as ts from 'typescript';
import * as _ from 'lodash';
import { CompilationOptions } from '../compiler';

export * from './build-prop-type-interface';

export function getReactComponentSuperClassName(
    classDeclaration: ts.ClassDeclaration | ts.ClassExpression,
    typeChecker: ts.TypeChecker,
): string | undefined {
    if ((ts.isClassDeclaration(classDeclaration) || ts.isClassExpression(classDeclaration)) && classDeclaration.heritageClauses && classDeclaration.heritageClauses.length == 1) {
        if (classDeclaration.heritageClauses[0].types.length == 1) {
            const firstType = classDeclaration.heritageClauses[0].types[0];
            const extendClassType = typeChecker.getTypeAtLocation(firstType);
            // check extend component or subclass of component
            if (extendClassType && extendClassType.getProperties().find(property => property.name === "shouldComponentUpdate")) {
                return firstType.expression.getText();
            }
        }
    }
    return undefined;
}

// 父类为Component的子类
export function isReactComponentGrandson(classDeclaration: ts.ClassDeclaration | ts.ClassExpression, typeChecker: ts.TypeChecker) {
    const superComponentName = getReactComponentSuperClassName(classDeclaration, typeChecker);
    return superComponentName && !/React\.Component|Component/.test(superComponentName);
}

/**
 * If a class declaration a react class?
 * @param classDeclaration
 * @param typeChecker
 */
export function isReactComponent(
    classDeclaration: ts.ClassDeclaration | ts.ClassExpression,
    typeChecker: ts.TypeChecker,
): boolean {
    const superComponentName = getReactComponentSuperClassName(classDeclaration, typeChecker);
    return  superComponentName != undefined;
}

/**
 * Determine if a ts.HeritageClause is React HeritageClause
 *
 * @example `extends React.Component<{}, {}>` is a React HeritageClause
 *
 * @todo: this is lazy. Use the typeChecker instead
 * @param clause
 */
export function isReactHeritageClause(clause: ts.HeritageClause) {
    return (
        clause.token === ts.SyntaxKind.ExtendsKeyword &&
        clause.types.length === 1 &&
        ts.isExpressionWithTypeArguments(clause.types[0]) &&
        /Component/.test(clause.types[0].expression.getText())
    );
}

/**
 * Return true if a statement is a React propType assignment statement
 * @example
 * SomeComponent.propTypes = { foo: React.PropTypes.string };
 * @param statement
 */
export function isReactPropTypeAssignmentStatement(statement: ts.Statement): statement is ts.ExpressionStatement {
    return (
        ts.isExpressionStatement(statement) &&
        ts.isBinaryExpression(statement.expression) &&
        statement.expression.operatorToken.kind === ts.SyntaxKind.FirstAssignment &&
        ts.isPropertyAccessExpression(statement.expression.left) &&
        /\.propTypes$|\.propTypes\..+$/.test(statement.expression.left.getText())
    );
}

/**
 * Does class member have a "static" member?
 * @param classMember
 */
export function hasStaticModifier(classMember: ts.ClassElement) {
    if (!classMember.modifiers) {
        return false;
    }
    const staticModifier = _.find(classMember.modifiers, modifier => {
        return modifier.kind == ts.SyntaxKind.StaticKeyword;
    });
    return staticModifier !== undefined;
}

/**
 * Is class member a React "propTypes" member?
 * @param classMember
 * @param sourceFile
 */
export function isPropTypesMember(classMember: ts.ClassElement, sourceFile: ts.SourceFile) {
    try {
        const name =
            classMember.name !== undefined && ts.isIdentifier(classMember.name) ? classMember.name.escapedText : null;
        return name === 'propTypes';
    } catch (e) {
        return false;
    }
}

/**
 * Get component name off of a propType assignment statement
 * @param propTypeAssignment
 * @param sourceFile
 */
export function getComponentName(propTypeAssignment: ts.Statement, sourceFile: ts.SourceFile) {
    if (!sourceFile) {
        // debug
        console.log(`undefiend`);
    }
    const text = propTypeAssignment.getText(sourceFile);
    return text.substr(0, text.indexOf('.'));
}

/**
 * Convert react stateless function to arrow function
 * @example
 * Before:
 * function Hello(message) {
 *   return <div>{message}</div>
 * }
 *
 * After:
 * const Hello = message => {
 *   return <div>{message}</div>
 * }
 */
export function convertReactStatelessFunctionToArrowFunction(
    statelessFunc: ts.FunctionDeclaration | ts.VariableStatement,
) {
    if (ts.isVariableStatement(statelessFunc)) return statelessFunc;

    const funcName = statelessFunc.name || 'Component';
    const funcBody = statelessFunc.body || ts.createBlock([]);

    const initializer = ts.createArrowFunction(
        undefined,
        undefined,
        statelessFunc.parameters,
        undefined,
        undefined,
        funcBody,
    );

    return ts.createVariableStatement(
        statelessFunc.modifiers,
        ts.createVariableDeclarationList(
            [ts.createVariableDeclaration(funcName, undefined, initializer)],
            ts.NodeFlags.Const,
        ),
    );
}

export function isThisProperty(n: ts.Node, properyName: string): n is ts.PropertyAccessExpression {
    if(ts.isPropertyAccessExpression(n) && ts.isIdentifier(n.name) && n.name.text===properyName ){
        if(n.expression.kind==ts.SyntaxKind.ThisKeyword){
            return  true;
        }
    }
    return false;
}

// Object.assign(this.state, {});
export function isObjectAssignState(n: ts.Node): boolean {
    // constructor  Object.assing(this.state , {})
        return ts.isExpressionStatement(n) &&
            ts.isCallExpression(n.expression) &&
            ts.isPropertyAccessExpression(n.expression.expression) &&
            ts.isIdentifier(n.expression.expression.name) &&
            n.expression.expression.name.text =='assign' &&
            ts.isIdentifier(n.expression.expression.expression) &&
            n.expression.expression.expression.text==='Object' &&
            n.expression.arguments.length == 2 &&
            isThisProperty(n.expression.arguments[0], 'state') &&
            ts.isObjectLiteralExpression(n.expression.arguments[1]);
}

/**
 * Insert an item in middle of an array after a specific item
 * @param collection
 * @param afterItem
 * @param newItem
 */
export function insertAfter<T>(collection: ArrayLike<T>, afterItem: T, newItem: T) {
    const index = _.indexOf(collection, afterItem) + 1;

    return _.slice(collection, 0, index)
        .concat(newItem)
        .concat(_.slice(collection, index));
}

/**
 * Insert an item in middle of an array before a specific item
 * @param collection
 * @param beforeItem
 * @param newItem
 */
export function insertBefore<T>(collection: ArrayLike<T>, beforeItem: T, newItems: T | T[]) {
    const index = _.indexOf(collection, beforeItem);

    return _.slice(collection, 0, index)
        .concat(newItems)
        .concat(_.slice(collection, index));
}

/**
 * Replace an item in a collection with another item
 * @param collection
 * @param item
 * @param newItem
 */
export function replaceItem<T>(collection: ArrayLike<T>, item: T, newItem: T) {
    const index = _.indexOf(collection, item);
    return _.slice(collection, 0, index)
        .concat(newItem)
        .concat(_.slice(collection, index + 1));
}

/**
 * Remove an item from a collection
 * @param collection
 * @param item
 * @param newItem
 */
export function removeItem<T>(collection: ArrayLike<T>, item: T) {
    const index = _.indexOf(collection, item);
    return _.slice(collection, 0, index).concat(_.slice(collection, index + 1));
}

/**
 *
 * @param statements
 * @param callback
 */
export function filter<T extends ts.Node>(
    statements: ts.Node[] | ts.NodeArray<ts.Node> = [],
    callback: (node: ts.Node) => boolean,
) {
    const result: T[] = [];
    walk(statements, node => {
        if (callback(node)) {
            result.push(node as T);
        }
    });
    return result;
}

/**
 *
 * @param statements
 * @param callback
 */
export function visitor(statements: ts.Node[] | ts.NodeArray<ts.Node> = [], callback: (node: ts.Node) => void) {
    walk(statements, callback);
}

function walk(statements: ts.Node[] | ts.NodeArray<ts.Node> = [], callback: (node: ts.Node) => void) {
    const queue: Array<ts.Node | undefined> = _.toArray(statements);
    let node: ts.Node | undefined;

    while ((node = queue.pop())) {
        callback(node);

        if (ts.isJsxElement(node)) {
            node.openingElement.attributes.forEachChild(child => {
                queue.push(child);
            });
            queue.push(...node.children);
            continue;
        }

        if (ts.isJsxSelfClosingElement(node)) {
            node.attributes.forEachChild(child => {
                queue.push(child);
            });
            continue;
        }

        if (ts.isBlock(node)) {
            queue.push(...node.statements);
            continue;
        }

        if ((node as any).thenStatement) {
            queue.push((node as any).thenStatement);
        }

        if ((node as any).elseStatement) {
            queue.push((node as any).elseStatement);
        }

        if ((node as any).initializer) {
            queue.push((node as any).initializer);
        }

        if ((node as any).expression) {
            queue.push((node as any).expression);
        }

        if ((node as any).declarationList) {
            queue.push(...(node as any).declarationList.declarations);
        }

        if (ts.isCallExpression(node)) {
            queue.push(...node.arguments);
        }

        if ((node as any).body) {
            queue.push((node as any).body);
        }

        if ((node as any).whenTrue) {
            queue.push((node as any).whenTrue);
        }

        if ((node as any).whenFlase) {
            queue.push((node as any).whenFlase);
        }

        if ((node as any).left) {
            queue.push((node as any).left);
        }

        if ((node as any).right) {
            queue.push((node as any).right);
        }
    }
}

export function fixTypeNode(typeNode: ts.TypeNode, typeChecker: ts.TypeChecker) : ts.TypeNode {
    if(ts.isArrayTypeNode(typeNode)){
        return ts.createArrayTypeNode(fixTypeNode(typeNode.elementType, typeChecker));
    }
    if(ts.isFunctionTypeNode(typeNode)){
        typeNode.type = fixTypeNode(typeNode.type, typeChecker);
        return typeNode;
    }
    if(ts.isTypeReferenceNode(typeNode) && ts.isIdentifier(typeNode.typeName)){
        const typeName = typeNode.typeName.text;
        if(typeName==='Element'){
           typeNode = ts.createTypeReferenceNode('React.ReactElement', []);
        }else if (typeName === 'ReactNode') {
            typeNode = ts.createTypeReferenceNode('React.ReactNode', []);
        }else if(typeName === 'Timeout'){
            typeNode = ts.createKeywordTypeNode(ts.SyntaxKind.NumberKeyword);
        }
        return  typeNode;
    }

    if(ts.isTypeLiteralNode(typeNode) && typeNode.members.length===0){
        //  this.obj = {}   =>   obj: {[key: string]: any}
        typeNode = ts.createTypeLiteralNode([
            ts.createIndexSignature(
                undefined,
                undefined,
                [
                    ts.createParameter(
                        undefined,
                        undefined,
                        undefined,
                        'key',
                        undefined,
                        ts.createKeywordTypeNode(ts.SyntaxKind.StringKeyword),
                    ),
                ],
                ts.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword),
            )]);
    }else if(ts.isLiteralTypeNode(typeNode)){
        if(ts.isStringLiteral(typeNode.literal)){
            typeNode = ts.createKeywordTypeNode(ts.SyntaxKind.StringKeyword);
        }else if(ts.isNumericLiteral(typeNode.literal)){
            typeNode = ts.createKeywordTypeNode(ts.SyntaxKind.NumberKeyword);
        }
    }else if([ts.SyntaxKind.UndefinedKeyword, ts.SyntaxKind.NullKeyword].includes(typeNode.kind)){
        typeNode = ts.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword);
    }else  if([ts.SyntaxKind.TrueKeyword, ts.SyntaxKind.FalseKeyword].includes(typeNode.kind)){
        typeNode = ts.createKeywordTypeNode(ts.SyntaxKind.BooleanKeyword);
    }
    return typeNode;
}


export function typeToTypeNode(type: ts.Type, typeChecker: ts.TypeChecker)  {
    const typeNode = typeChecker.typeToTypeNode(type);
    if(!typeNode) return typeNode;
    return fixTypeNode(typeNode, typeChecker);
}


export function walkEachNode(node:ts.Node, processor: (node:ts.Node)=>void) {
    node.forEachChild(node1 => {
        processor(node1);
        walkEachNode(node1,processor);
    })
}

export function filterEachNode<T extends ts.Node>(node: ts.Node, filter: (node:ts.Node)=>boolean): Array<T> {
    let array = new Array<T>();
    walkEachNode(node,target=>{
        if(filter(target)){
            array.push(target as T);
        }
    });
    return array;
}

function commentTrim(comment: string, target: string = '/') {
    if(!comment) return comment;
    comment = comment.trimLeft();
    while (comment.startsWith(target) && comment.length > 0) {
        comment = comment.substring(target.length);
    }
    return comment;
}

export function copyLeadingComment(source: ts.Node, target: ts.Node) {
    const sourceText = source.getSourceFile().text;
    const ranges = ts.getLeadingCommentRanges(sourceText, source.getFullStart());
    if (ranges) {
        ranges.forEach(range => {
            if (range.kind == ts.SyntaxKind.SingleLineCommentTrivia) {
                let comment = commentTrim(sourceText.substring(range.pos, range.end));
                if (comment) {
                    ts.addSyntheticLeadingComment(target, ts.SyntaxKind.SingleLineCommentTrivia, comment);
                }
            }else if (range.kind == ts.SyntaxKind.MultiLineCommentTrivia) {
                let comments = sourceText.substring(range.pos, range.end);
                comments =  comments.split("\n").map((comment,index)=>{
                    comment =commentTrim(comment,"/*");
                    comment =comment.trimRight();
                    if(comment.endsWith("*/")){
                        comment = comment.substring(0, comment.length - 2);
                    }
                    comment =comment.trim();
                    return comment;
                }).join("\n");
                if (comments) {
                    ts.addSyntheticLeadingComment(target, ts.SyntaxKind.MultiLineCommentTrivia, comments, true);
                }
            }
        })
    }
}

export function copyTrailingComment(source: ts.Node, target: ts.Node, endPadding= 0, hasTrailingNewLine = false) {
    const sourceText = source.getSourceFile().text;
    const ranges = ts.getTrailingCommentRanges(sourceText, source.end + endPadding);
    if (ranges) {
        ranges.forEach(range => {
            if (range.kind == ts.SyntaxKind.SingleLineCommentTrivia) {
                let comment = commentTrim(sourceText.substring(range.pos, range.end));
                if (comment) {
                    ts.addSyntheticTrailingComment(target, ts.SyntaxKind.SingleLineCommentTrivia, comment, hasTrailingNewLine);
                }
            }
        })
    }
}

export function copyComment(source: ts.Node, target: ts.Node) {
    copyLeadingComment(source, target);
    copyTrailingComment(source,target);
}





export type TransformFactoryAndRecompile =   ts.TransformerFactory<ts.SourceFile>