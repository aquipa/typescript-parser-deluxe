import {
    Declaration,
    getCombinedModifierFlags,
    isArrayLiteralExpression,
    isNumericLiteral,
    isObjectLiteralExpression,
    isStringLiteral,
    ModifierFlags,
    Node,
    SyntaxKind,
    TypeNode,
} from 'typescript';

import { DeclarationVisibility } from '../declarations/DeclarationVisibility';
import { File } from '../resources/File';
import { Resource } from '../resources/Resource';

/**
 * Checks if the given typescript node has the exported flag.
 * (e.g. export class Foobar).
 *
 * @export
 * @param {Node} node
 * @returns {boolean}
 */
export function isNodeExported(node: Node): boolean {
    const flags = getCombinedModifierFlags(node as Declaration);
    return (flags & ModifierFlags.Export) === ModifierFlags.Export;
}

/**
 * Checks if the given typescript node has the default flag.
 * (e.g. export default class Foobar).
 *
 * @export
 * @param {Node} node
 * @returns {boolean}
 */
export function isNodeDefaultExported(node: Node): boolean {
    const flags = getCombinedModifierFlags(node as Declaration);
    return (flags & ModifierFlags.Default) === ModifierFlags.Default;
}

/**
 * Returns the type text (type information) for a given node.
 *
 * @export
 * @param {(TypeNode | undefined)} node
 * @returns {(string | undefined)}
 */
export function getNodeType(node:any, type: TypeNode | undefined): string | undefined {
    let output = undefined;
    output = type ? type.getText() : undefined;
    if (node && node.initializer && output === undefined) {
        const initializer = node.initializer;
        if (initializer !== undefined) {
            output = getNodeType(initializer, undefined);
        }
    } else if (node && output === undefined && node.kind === 101 || node.kind === 86) {
        output = 'boolean';
    }else if (node && isStringLiteral(node) && output === undefined) {
        output =  'string';
    } else if (node && isNumericLiteral(node) && output === undefined) {
        output =  'number';
    } else if (node && isArrayLiteralExpression(node) && output === undefined) {
        const type:string[]  = [];
        for (let i = 0; node.elements.length > i; i++) {
            const curType:string | undefined = getNodeType(node.elements[i], undefined);
            if (type.length === 0 && curType !== undefined) {
                type.push(curType);
            } else if (curType !== undefined && type.indexOf(curType) === -1) {
                type.push(curType);
            }
        }
        if (type.length === 1) {
            output =  'Array<' + type[0] + '>';
        } else {
            output = 'Array<any>'; 'Array<any>';
        }
    } else if (node && isObjectLiteralExpression(node)) {
        let count = 0;
        let out = '{ ';
        for (const prop of node.properties) {
            const identif = prop.getText();
            out += identif.slice(0, identif.indexOf(':') + 1) + ' ' + getNodeType(prop, undefined);
            if (count !== node.properties.length - 1) {
                out += ', ';
            }
            count += 1;
        }
        out += ' }';
        output = out;
    }
    return output;
}

/**
 * Checks if a node contains a certain modifier (of a given kind)
 *
 * @export
 * @param {Node} node
 * @param {SyntaxKind} modifierKind
 * @returns {boolean}
 */
export function containsModifier(node: Node, modifierKind: SyntaxKind): boolean {
    if (!node.modifiers) return false;
    return node.modifiers.some(mod => mod.kind === modifierKind);
}

/**
 * Returns the enum value (visibility) of a node.
 *
 * @export
 * @param {Node} node
 * @returns {(DeclarationVisibility | undefined)}
 */
export function getNodeVisibility(node: Node): DeclarationVisibility | undefined {
    if (!node.modifiers) {
        return undefined;
    }

    for (const modifier of node.modifiers) {
        switch (modifier.kind) {
            case SyntaxKind.PublicKeyword:
                return DeclarationVisibility.Public;
            case SyntaxKind.ProtectedKeyword:
                return DeclarationVisibility.Protected;
            case SyntaxKind.PrivateKeyword:
                return DeclarationVisibility.Private;
            default:
                break;
        }
    }
}

/**
 * Function that calculates the default name of a resource.
 * This is used when a default export has no name (i.e. export class {}).
 *
 * @export
 * @param {TsResource} resource
 * @returns {string}
 */
export function getDefaultResourceIdentifier(resource: Resource): string {
    if (resource instanceof File && resource.isWorkspaceFile) {
        return resource.parsedPath.name;
    }
    return resource.identifier;
}
