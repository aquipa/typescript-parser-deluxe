import {
    ArrayBindingPattern,
    ClassDeclaration,
    ClassLikeDeclarationBase,
    ConstructorDeclaration,
    Identifier,
    MethodDeclaration,
    Node,
    ObjectBindingPattern,
    PropertyDeclaration,
    SyntaxKind,
} from 'typescript';

import { GetterDeclaration, SetterDeclaration } from '../declarations/AccessorDeclaration';
import { ClassDeclaration as TshClass } from '../declarations/ClassDeclaration';
import { ConstructorDeclaration as TshConstructor } from '../declarations/ConstructorDeclaration';
import { DefaultDeclaration as TshDefault } from '../declarations/DefaultDeclaration';
import { MethodDeclaration as TshMethod } from '../declarations/MethodDeclaration';
import { ParameterDeclaration as TshParameter } from '../declarations/ParameterDeclaration';
import { PropertyDeclaration as TshProperty } from '../declarations/PropertyDeclaration';
import { Resource } from '../resources/Resource';
import {
    isArrayBindingPattern,
    isConstructorDeclaration,
    isGetAccessorDeclaration,
    isIdentifier,
    isMethodDeclaration,
    isObjectBindingPattern,
    isPropertyDeclaration,
    isSetAccessorDeclaration,
} from '../type-guards/TypescriptGuards';
import { parseFunctionParts, parseMethodParams } from './function-parser';
import { parseIdentifier } from './identifier-parser';
import {
    containsModifier,
    getDefaultResourceIdentifier,
    getNodeType,
    getNodeVisibility,
    isNodeDefaultExported,
    isNodeExported,
} from './parse-utilities';

/**
 * Parses the identifiers of a class (usages).
 *
 * @export
 * @param {Resource} tsResource
 * @param {Node} node
 */
export function parseClassIdentifiers(tsResource: Resource, node: Node): void {
    for (const child of node.getChildren()) {
        switch (child.kind) {
            case SyntaxKind.Identifier:
                parseIdentifier(tsResource, <Identifier>child);
                break;
            default:
                break;
        }
        parseClassIdentifiers(tsResource, child);
    }
}

/**
 * Parse method parameters.
 *
 * @export
 * @param {(FunctionDeclaration | MethodDeclaration | MethodSignature)} node
 * @returns {TshParameter[]}
 */
export function parseTypeArguments(
    node: TshParameter | TshProperty | PropertyDeclaration | MethodDeclaration,
): TshParameter[] | string {

    if (!node.type) return [];
    if ((!(<any>node.type).typeArguments || !(<any>node.type).typeArguments.length)
        && !(<any>node.type).members) return [];

    let target;

    if ((<any>node.type).typeArguments && (<any>node.type).typeArguments.length) {
        if ((<any>node.type).typeArguments[0].constructor.name === 'TokenObject') {
            if (node.type.typeArguments[0].kind === 119) {
                return 'any';
            }
            return [];
        }
        if (!(<any>node.type).typeArguments[0].members) {
            return [];
        }
        target = (<any>node.type).typeArguments[0].members;
    } else if ((<any>node.type).members) {
        target = (<any>node.type).members;
    } else {
        return [];
    }
    const parentsToChildren = new Map<ClassLikeDeclarationBase
        & { type: { members: ClassLikeDeclarationBase[]; } }, ClassLikeDeclarationBase[]>();
    return target.reduce(
        (all: TshParameter[], cur: ClassLikeDeclarationBase & { type: { members: ClassLikeDeclarationBase[] } }) => {
            const params = all;
            if (cur.type && (<any>cur.type).members) {
                if (!cur.name) {
                    return params;
                }

                // it's an array of members.
                for (const member of cur.type.members) {
                    if (!parentsToChildren.get(cur)) {
                        parentsToChildren.set(cur, []);
                    }
                    const c = parentsToChildren.get(cur);
                    if (c) {
                        c.push(member);
                    }
                }

                const newParam = new TshParameter(
                    <string>(cur.name as Identifier).escapedText,
                    parseTypeArguments(cur.type.members as any),
                    cur.getStart(),
                    cur.getEnd());

                const c = parentsToChildren.get(cur);
                if (c) {
                    for (const item of c) {
                        // const finalInsert = (item.kind === 163) ? item.getText() :
                        // console.log(item.getText())
                        let finalText;
                        if (item.kind === 167) {
                            // its an index signature.
                            finalText = '';
                            for (const child of item.getChildren()) {
                                finalText += child.getText();
                                if (child.kind === 23) {
                                    break;
                                }
                            }
                        } else if (!item.name) {
                            continue;
                        } else {
                            finalText = item.name.escapedText;
                        }
                        newParam.members.push(
                            new TshParameter(
                                finalText as string,
                                (item as any).type.getText(),
                                item.getStart(),
                                item.getEnd(),
                            ),
                        );
                    }
                }

                params.push(newParam);
            } else {
                if (!cur.name) {
                    return params;
                }
                params.push(new TshParameter(
                    <string>(cur.name as Identifier).escapedText,
                    getNodeType(cur, (cur as any).type), cur.getStart(), cur.getEnd(),
                ));
            }
            return params;
        },
        []);

}

/**
 * Parse information about a constructor. Contains parameters and used modifiers
 * (i.e. constructor(private name: string)).
 *
 * @export
 * @param {TshClass} parent
 * @param {TshConstructor} ctor
 * @param {ConstructorDeclaration} node
 */
export function parseCtorParams(
    parent: TshClass,
    ctor: TshConstructor,
    node: ConstructorDeclaration,
): void {
    if (!node.parameters) {
        return;
    }
    node.parameters.forEach((o) => {
        if (isIdentifier(o.name)) {
            ctor.parameters.push(
                new TshParameter(
                    (o.name as Identifier).text, getNodeType(o, o.type), o.getStart(), o.getEnd(),
                ),
            );
            if (!o.modifiers) {
                return;
            }
            parent.properties.push(
                new TshProperty(
                    (o.name as Identifier).text,
                    getNodeVisibility(o),
                    getNodeType(o, o.type),
                    !!o.questionToken,
                    containsModifier(o, SyntaxKind.StaticKeyword),
                    o.getStart(),
                    o.getEnd(),
                ),
            );
        } else if (isObjectBindingPattern(o.name) || isArrayBindingPattern(o.name)) {
            const identifiers = o.name as ObjectBindingPattern | ArrayBindingPattern;
            const elements = [...identifiers.elements];
            // TODO: BindingElement
            ctor.parameters = ctor.parameters.concat(<TshParameter[]>elements.map((bind: any) => {
                if (isIdentifier(bind.name)) {
                    return new TshParameter(
                        (bind.name as Identifier).text, undefined, bind.getStart(), bind.getEnd(),
                    );
                }
            }).filter(Boolean));
        }
    });
}

/**
 * Parses a class node into its declaration. Calculates the properties, constructors and methods of the class.
 *
 * @export
 * @param {Resource} tsResource
 * @param {ClassDeclaration} node
 */
export function parseClass(tsResource: Resource, node: ClassDeclaration): void {
    const name = node.name ? node.name.text : getDefaultResourceIdentifier(tsResource);
    const classDeclaration = new TshClass(name, isNodeExported(node), node.getStart(), node.getEnd());

    if (isNodeDefaultExported(node)) {
        classDeclaration.isExported = false;
        tsResource.declarations.push(new TshDefault(classDeclaration.name, tsResource));
    }

    if (node.typeParameters) {
        classDeclaration.typeParameters = node.typeParameters.map(param => param.getText());
    }

    if (node.members) {
        node.members.forEach((o) => {
            if (isPropertyDeclaration(o)) {
                const actualCount = classDeclaration.properties.length;
                if (o.modifiers) {
                    const newProperty = new TshProperty(
                        (o.name as Identifier).text,
                        getNodeVisibility(o),
                        getNodeType(o, o.type),
                        !!o.questionToken,
                        containsModifier(o, SyntaxKind.StaticKeyword),
                        o.getStart(),
                        o.getEnd(),
                    );
                    newProperty.typeArguments = parseTypeArguments(o) as TshParameter[];
                    classDeclaration.properties.push(newProperty);
                }
                if (actualCount === classDeclaration.properties.length) {
                    const newProperty = new TshProperty(
                        (o.name as Identifier).text,
                        getNodeVisibility(o),
                        getNodeType(o, o.type),
                        !!o.questionToken,
                        containsModifier(o, SyntaxKind.StaticKeyword),
                        o.getStart(),
                        o.getEnd(),
                    );
                    newProperty.typeArguments = parseTypeArguments(o) as TshParameter[];
                    classDeclaration.properties.push(newProperty);
                }
                return;
            }

            if (isGetAccessorDeclaration(o)) {
                classDeclaration.accessors.push(
                    new GetterDeclaration(
                        (o.name as Identifier).text,
                        getNodeVisibility(o),
                        getNodeType(o, o.type),
                        o.modifiers !== undefined && o.modifiers.some(m => m.kind === SyntaxKind.AbstractKeyword),
                        containsModifier(o, SyntaxKind.StaticKeyword),
                        o.getStart(),
                        o.getEnd(),
                    ),
                );
            }

            if (isSetAccessorDeclaration(o)) {
                classDeclaration.accessors.push(
                    new SetterDeclaration(
                        (o.name as Identifier).text,
                        getNodeVisibility(o),
                        getNodeType(o, o.type),
                        o.modifiers !== undefined && o.modifiers.some(m => m.kind === SyntaxKind.AbstractKeyword),
                        containsModifier(o, SyntaxKind.StaticKeyword),
                        o.getStart(),
                        o.getEnd(),
                    ),
                );
            }

            if (isConstructorDeclaration(o)) {
                const ctor = new TshConstructor(classDeclaration.name, o.getStart(), o.getEnd());
                parseCtorParams(classDeclaration, ctor, o);
                classDeclaration.ctor = ctor;
                parseFunctionParts(tsResource, ctor, o);
            } else if (isMethodDeclaration(o)) {
                const method = new TshMethod(
                    (o.name as Identifier).text,
                    o.modifiers !== undefined && o.modifiers.some(m => m.kind === SyntaxKind.AbstractKeyword),
                    getNodeVisibility(o),
                    getNodeType(o, o.type),
                    !!o.questionToken,
                    containsModifier(o, SyntaxKind.StaticKeyword),
                    containsModifier(o, SyntaxKind.AsyncKeyword),
                    o.getStart(),
                    o.getEnd(),
                );
                method.parameters = parseMethodParams(o);
                method.typeArguments = parseTypeArguments(o) as TshParameter[];
                classDeclaration.methods.push(method);
                parseFunctionParts(tsResource, method, o);
            }
        });
    }

    parseClassIdentifiers(tsResource, node);

    tsResource.declarations.push(classDeclaration);
}
