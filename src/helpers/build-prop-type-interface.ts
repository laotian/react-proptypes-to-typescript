import * as ts from 'typescript';
import { SyntaxKind } from 'typescript';
import * as helpers from './index';


function getObjetKeys(objectLiteral: ts.ObjectLiteralExpression): Array<string> {
    return  objectLiteral.properties.filter(ts.isPropertyAssignment)
        .filter(node=>{
            if(!node.initializer) return false;
            if(node.initializer.kind==SyntaxKind.NullKeyword) return false;
            if(ts.isIdentifier(node.initializer) && (node.initializer.text=='undefined')){
                return false;
            }
            return true;
        })
        .map(node=>node.name)
        .filter(ts.isIdentifier)
        .map(node=>node.text);
}


export function getDefaultPropsByClass(classDeclaration:ts.ClassDeclaration):Array<string> {
    const keys = new Array<string>();
    classDeclaration.members.filter(ts.isPropertyDeclaration)
        .filter(node=> helpers.hasStaticModifier(node) && ts.isIdentifier(node.name) && node.name.text==='defaultProps' && node.initializer && ts.isObjectLiteralExpression(node.initializer))
        .forEach(node=>{
            const defineKeys = getObjetKeys(node.initializer as ts.ObjectLiteralExpression);
            defineKeys.forEach(key=>{
                keys.push(key);
            });
        });
    return keys;
}

/**
 * Build props interface from propTypes object
 * @example
 * {
 *   foo: React.PropTypes.string.isRequired
 * }
 *
 * becomes
 * {
 *  foo: string;
 * }
 * @param objectLiteral
 */
export function buildInterfaceFromPropTypeObjectLiteral(objectLiteral: ts.ObjectLiteralExpression) {
    const members = objectLiteral.properties
        // We only need to process PropertyAssignment:
        // {
        //    a: 123     // PropertyAssignment
        // }
        //
        // filter out:
        // {
        //   a() {},     // MethodDeclaration
        //   b,          // ShorthandPropertyAssignment
        //   ...c,       // SpreadAssignment
        //   get d() {}, // AccessorDeclaration
        // }
        .filter(ts.isPropertyAssignment)
        // Ignore children, React types have it
        .filter(property => property.name.getText() !== 'children')
        .map(propertyAssignment => {
            const name = propertyAssignment.name.getText();
            const initializer = propertyAssignment.initializer;
            const isRequired = isPropTypeRequired(initializer);
            const typeExpression = isRequired
                ? // We have guaranteed the type in `isPropTypeRequired()`
                  (initializer as ts.PropertyAccessExpression).expression
                : initializer;
            const typeValue = getTypeFromReactPropTypeExpression(typeExpression);

            const sig = ts.createPropertySignature(
                [],
                name,
                isRequired ? undefined : ts.createToken(ts.SyntaxKind.QuestionToken),
                typeValue,
                undefined,
            );
            helpers.copyComment(propertyAssignment, sig);
            return sig;
        });

    return ts.createTypeLiteralNode(members);
}

/**
 * Turns React.PropTypes.* into TypeScript type value
 *
 * @param node React propTypes value
 */
export function getTypeFromReactPropTypeExpression(node: ts.Expression): ts.TypeNode {
    let result = null;
    if (ts.isPropertyAccessExpression(node)) {
        /**
         * PropTypes.array,
         * PropTypes.bool,
         * PropTypes.func,
         * PropTypes.number,
         * PropTypes.object,
         * PropTypes.string,
         * PropTypes.symbol, (ignore)
         * PropTypes.node,
         * PropTypes.element,
         * PropTypes.any,
         */
        const text = node.getText().replace(/React\.PropTypes\./, '');

        if (/string/.test(text)) {
            result = ts.createKeywordTypeNode(ts.SyntaxKind.StringKeyword);
        } else if (/any/.test(text)) {
            result = ts.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword);
        } else if (/array/.test(text)) {
            result = ts.createArrayTypeNode(ts.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword));
        } else if (/bool/.test(text)) {
            result = ts.createKeywordTypeNode(ts.SyntaxKind.BooleanKeyword);
        } else if (/number/.test(text)) {
            result = ts.createKeywordTypeNode(ts.SyntaxKind.NumberKeyword);
        } else if (/object/.test(text)) {
            // result = ts.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword);
            result = ts.createTypeLiteralNode([
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
        } else if (/node/.test(text)) {
            result = ts.createTypeReferenceNode('React.ReactNode', []);
        } else if (/element/.test(text)) {
            result = ts.createTypeReferenceNode('React.ReactElement', []);
        } else if (/func/.test(text)) {
            const arrayOfAny = ts.createParameter(
                [],
                [],
                ts.createToken(ts.SyntaxKind.DotDotDotToken),
                'args',
                undefined,
                ts.createArrayTypeNode(ts.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword)),
                undefined,
            );
            result = ts.createFunctionTypeNode([], [arrayOfAny], ts.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword));
        }
    } else if (ts.isCallExpression(node)) {
        /**
         * PropTypes.instanceOf(), (ignore)
         * PropTypes.oneOf(), // only support oneOf([1, 2]), oneOf(['a', 'b'])
         * PropTypes.oneOfType(),
         * PropTypes.arrayOf(),
         * PropTypes.objectOf(),
         * PropTypes.shape(),
         */
        const text = node.expression.getText();
        if (/oneOf$/.test(text)) {
            const argument = node.arguments[0];
            if (ts.isArrayLiteralExpression(argument)) {
                if (argument.elements.every(elm => ts.isStringLiteral(elm) || ts.isNumericLiteral(elm))) {
                    result = ts.createUnionTypeNode(
                        (argument.elements as ts.NodeArray<ts.StringLiteral | ts.NumericLiteral>).map(elm =>
                            ts.createLiteralTypeNode(elm),
                        ),
                    );
                }
            }
        } else if (/oneOfType$/.test(text)) {
            const argument = node.arguments[0];
            if (ts.isArrayLiteralExpression(argument)) {
                result = ts.createUnionOrIntersectionTypeNode(
                    ts.SyntaxKind.UnionType,
                    argument.elements.map(elm => getTypeFromReactPropTypeExpression(elm)),
                );
            }
        } else if (/arrayOf$/.test(text)) {
            const argument = node.arguments[0];
            if (argument) {
                result = ts.createArrayTypeNode(getTypeFromReactPropTypeExpression(argument));
            }
        } else if (/objectOf$/.test(text)) {
            const argument = node.arguments[0];
            if (argument) {
                result = ts.createTypeLiteralNode([
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
                        getTypeFromReactPropTypeExpression(argument),
                    ),
                ]);
            }
        } else if (/shape$/.test(text)) {
            const argument = node.arguments[0];
            if (ts.isObjectLiteralExpression(argument)) {
                return buildInterfaceFromPropTypeObjectLiteral(argument);
            }
        }
    }

    /**
     * customProp,
     * anything others
     */
    if (result === null) {
        result = ts.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword);
    }

    return result;
}

/**
 * Decide if node is required
 * @param node React propTypes member node
 */
function isPropTypeRequired(node: ts.Expression) {
    if (!ts.isPropertyAccessExpression(node)) return false;

    const text = node.getText().replace(/React\.PropTypes\./, '');
    return /\.isRequired/.test(text);
}
