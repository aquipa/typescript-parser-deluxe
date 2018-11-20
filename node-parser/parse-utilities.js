"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const typescript_1 = require("typescript");
const File_1 = require("../resources/File");
/**
 * Checks if the given typescript node has the exported flag.
 * (e.g. export class Foobar).
 *
 * @export
 * @param {Node} node
 * @returns {boolean}
 */
function isNodeExported(node) {
    const flags = typescript_1.getCombinedModifierFlags(node);
    return (flags & typescript_1.ModifierFlags.Export) === typescript_1.ModifierFlags.Export;
}
exports.isNodeExported = isNodeExported;
/**
 * Checks if the given typescript node has the default flag.
 * (e.g. export default class Foobar).
 *
 * @export
 * @param {Node} node
 * @returns {boolean}
 */
function isNodeDefaultExported(node) {
    const flags = typescript_1.getCombinedModifierFlags(node);
    return (flags & typescript_1.ModifierFlags.Default) === typescript_1.ModifierFlags.Default;
}
exports.isNodeDefaultExported = isNodeDefaultExported;
/**
 * Returns the type text (type information) for a given node.
 *
 * @export
 * @param {(TypeNode | undefined)} node
 * @returns {(string | undefined)}
 */
function getNodeType(node, type) {
    let output = undefined;
    output = type ? type.getText() : undefined;
    if (node && node.initializer && output === undefined) {
        const initializer = node.initializer;
        if (initializer !== undefined) {
            output = getNodeType(initializer, undefined);
        }
    }
    else if (node && output === undefined && node.kind === 101 || node.kind === 86) {
        output = 'boolean';
    }
    else if (node && typescript_1.isStringLiteral(node) && output === undefined) {
        output = 'string';
    }
    else if (node && typescript_1.isNumericLiteral(node) && output === undefined) {
        output = 'number';
    }
    else if (node && typescript_1.isArrayLiteralExpression(node) && output === undefined) {
        const type = [];
        for (let i = 0; node.elements.length > i; i++) {
            const curType = getNodeType(node.elements[i], undefined);
            if (type.length === 0 && curType !== undefined) {
                type.push(curType);
            }
            else if (curType !== undefined && type.indexOf(curType) === -1) {
                type.push(curType);
            }
        }
        if (type.length === 1) {
            output = 'Array<' + type[0] + '>';
        }
        else {
            output = 'Array<any>';
            'Array<any>';
        }
    }
    else if (node && typescript_1.isObjectLiteralExpression(node)) {
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
exports.getNodeType = getNodeType;
/**
 * Checks if a node contains a certain modifier (of a given kind)
 *
 * @export
 * @param {Node} node
 * @param {SyntaxKind} modifierKind
 * @returns {boolean}
 */
function containsModifier(node, modifierKind) {
    if (!node.modifiers)
        return false;
    return node.modifiers.some(mod => mod.kind === modifierKind);
}
exports.containsModifier = containsModifier;
/**
 * Returns the enum value (visibility) of a node.
 *
 * @export
 * @param {Node} node
 * @returns {(DeclarationVisibility | undefined)}
 */
function getNodeVisibility(node) {
    if (!node.modifiers) {
        return undefined;
    }
    for (const modifier of node.modifiers) {
        switch (modifier.kind) {
            case typescript_1.SyntaxKind.PublicKeyword:
                return 2 /* Public */;
            case typescript_1.SyntaxKind.ProtectedKeyword:
                return 1 /* Protected */;
            case typescript_1.SyntaxKind.PrivateKeyword:
                return 0 /* Private */;
            default:
                break;
        }
    }
}
exports.getNodeVisibility = getNodeVisibility;
/**
 * Function that calculates the default name of a resource.
 * This is used when a default export has no name (i.e. export class {}).
 *
 * @export
 * @param {TsResource} resource
 * @returns {string}
 */
function getDefaultResourceIdentifier(resource) {
    if (resource instanceof File_1.File && resource.isWorkspaceFile) {
        return resource.parsedPath.name;
    }
    return resource.identifier;
}
exports.getDefaultResourceIdentifier = getDefaultResourceIdentifier;
