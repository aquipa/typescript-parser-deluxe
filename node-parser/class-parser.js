"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const typescript_1 = require("typescript");
const AccessorDeclaration_1 = require("../declarations/AccessorDeclaration");
const ClassDeclaration_1 = require("../declarations/ClassDeclaration");
const ConstructorDeclaration_1 = require("../declarations/ConstructorDeclaration");
const DefaultDeclaration_1 = require("../declarations/DefaultDeclaration");
const MethodDeclaration_1 = require("../declarations/MethodDeclaration");
const ParameterDeclaration_1 = require("../declarations/ParameterDeclaration");
const PropertyDeclaration_1 = require("../declarations/PropertyDeclaration");
const TypescriptGuards_1 = require("../type-guards/TypescriptGuards");
const function_parser_1 = require("./function-parser");
const identifier_parser_1 = require("./identifier-parser");
const parse_utilities_1 = require("./parse-utilities");
/**
 * Parses the identifiers of a class (usages).
 *
 * @export
 * @param {Resource} tsResource
 * @param {Node} node
 */
function parseClassIdentifiers(tsResource, node) {
    for (const child of node.getChildren()) {
        switch (child.kind) {
            case typescript_1.SyntaxKind.Identifier:
                identifier_parser_1.parseIdentifier(tsResource, child);
                break;
            default:
                break;
        }
        parseClassIdentifiers(tsResource, child);
    }
}
exports.parseClassIdentifiers = parseClassIdentifiers;
/**
 * Parse method parameters.
 *
 * @export
 * @param {(FunctionDeclaration | MethodDeclaration | MethodSignature)} node
 * @returns {TshParameter[]}
 */
function parseTypeArguments(node) {
    if (!node.type)
        return [];
    if ((!node.type.typeArguments || !node.type.typeArguments.length)
        && !node.type.members)
        return [];
    let target;
    if (node.type.typeArguments && node.type.typeArguments.length) {
        if (node.type.typeArguments[0].constructor.name === 'TokenObject') {
            if (node.type.typeArguments[0].kind === 119) {
                return 'any';
            }
            return [];
        }
        if (!node.type.typeArguments[0].members) {
            return [];
        }
        target = node.type.typeArguments[0].members;
    }
    else if (node.type.members) {
        target = node.type.members;
    }
    else {
        return [];
    }
    const parentsToChildren = new Map();
    const positionCache = {};
    return target.reduce((all, cur) => {
        const params = all;
        if (cur.type && cur.type.members) {
            if (!cur.name) {
                return params;
            }
            // it's an array of members.
            for (const member of cur.type.members) {
                if (!parentsToChildren.get(cur)) {
                    parentsToChildren.set(cur, []);
                }
                parentsToChildren.get(cur).push(member);
            }
            const newParam = new ParameterDeclaration_1.ParameterDeclaration(cur.name.escapedText, parseTypeArguments(cur.type.members), cur.getStart(), cur.getEnd());
            for (const arr of parentsToChildren.values()) {
                for (const item of arr) {
                    if (positionCache[item.pos] === true) {
                        continue;
                    }
                    let finalText;
                    if (item.kind === 163) {
                        // its an index signature.
                        finalText = '';
                        for (const child of item.getChildren()) {
                            finalText += child.getText();
                            if (child.kind === 23) {
                                break;
                            }
                        }
                    }
                    else {
                        finalText = item.name.escapedText;
                    }
                    newParam.members.push(new ParameterDeclaration_1.ParameterDeclaration(finalText, item.type.getText(), item.getStart(), item.getEnd()));
                }
            }
            params.push(newParam);
        }
        else {
            if (!cur.name) {
                return params;
            }
            params.push(new ParameterDeclaration_1.ParameterDeclaration(cur.name.escapedText, parse_utilities_1.getNodeType(cur, cur.type), cur.getStart(), cur.getEnd()));
        }
        return params;
    }, []);
}
exports.parseTypeArguments = parseTypeArguments;
/**
 * Parse information about a constructor. Contains parameters and used modifiers
 * (i.e. constructor(private name: string)).
 *
 * @export
 * @param {TshClass} parent
 * @param {TshConstructor} ctor
 * @param {ConstructorDeclaration} node
 */
function parseCtorParams(parent, ctor, node) {
    if (!node.parameters) {
        return;
    }
    node.parameters.forEach((o) => {
        if (TypescriptGuards_1.isIdentifier(o.name)) {
            ctor.parameters.push(new ParameterDeclaration_1.ParameterDeclaration(o.name.text, parse_utilities_1.getNodeType(o, o.type), o.getStart(), o.getEnd()));
            if (!o.modifiers) {
                return;
            }
            parent.properties.push(new PropertyDeclaration_1.PropertyDeclaration(o.name.text, parse_utilities_1.getNodeVisibility(o), parse_utilities_1.getNodeType(o, o.type), !!o.questionToken, parse_utilities_1.containsModifier(o, typescript_1.SyntaxKind.StaticKeyword), o.getStart(), o.getEnd()));
        }
        else if (TypescriptGuards_1.isObjectBindingPattern(o.name) || TypescriptGuards_1.isArrayBindingPattern(o.name)) {
            const identifiers = o.name;
            const elements = [...identifiers.elements];
            // TODO: BindingElement
            ctor.parameters = ctor.parameters.concat(elements.map((bind) => {
                if (TypescriptGuards_1.isIdentifier(bind.name)) {
                    return new ParameterDeclaration_1.ParameterDeclaration(bind.name.text, undefined, bind.getStart(), bind.getEnd());
                }
            }).filter(Boolean));
        }
    });
}
exports.parseCtorParams = parseCtorParams;
/**
 * Parses a class node into its declaration. Calculates the properties, constructors and methods of the class.
 *
 * @export
 * @param {Resource} tsResource
 * @param {ClassDeclaration} node
 */
function parseClass(tsResource, node) {
    const name = node.name ? node.name.text : parse_utilities_1.getDefaultResourceIdentifier(tsResource);
    const classDeclaration = new ClassDeclaration_1.ClassDeclaration(name, parse_utilities_1.isNodeExported(node), node.getStart(), node.getEnd());
    if (parse_utilities_1.isNodeDefaultExported(node)) {
        classDeclaration.isExported = false;
        tsResource.declarations.push(new DefaultDeclaration_1.DefaultDeclaration(classDeclaration.name, tsResource));
    }
    if (node.typeParameters) {
        classDeclaration.typeParameters = node.typeParameters.map(param => param.getText());
    }
    if (node.members) {
        node.members.forEach((o) => {
            if (TypescriptGuards_1.isPropertyDeclaration(o)) {
                const actualCount = classDeclaration.properties.length;
                if (o.modifiers) {
                    const newProperty = new PropertyDeclaration_1.PropertyDeclaration(o.name.text, parse_utilities_1.getNodeVisibility(o), parse_utilities_1.getNodeType(o, o.type), !!o.questionToken, parse_utilities_1.containsModifier(o, typescript_1.SyntaxKind.StaticKeyword), o.getStart(), o.getEnd());
                    newProperty.typeArguments = parseTypeArguments(o);
                    classDeclaration.properties.push(newProperty);
                }
                if (actualCount === classDeclaration.properties.length) {
                    const newProperty = new PropertyDeclaration_1.PropertyDeclaration(o.name.text, parse_utilities_1.getNodeVisibility(o), parse_utilities_1.getNodeType(o, o.type), !!o.questionToken, parse_utilities_1.containsModifier(o, typescript_1.SyntaxKind.StaticKeyword), o.getStart(), o.getEnd());
                    newProperty.typeArguments = parseTypeArguments(o);
                    classDeclaration.properties.push(newProperty);
                }
                return;
            }
            if (TypescriptGuards_1.isGetAccessorDeclaration(o)) {
                classDeclaration.accessors.push(new AccessorDeclaration_1.GetterDeclaration(o.name.text, parse_utilities_1.getNodeVisibility(o), parse_utilities_1.getNodeType(o, o.type), o.modifiers !== undefined && o.modifiers.some(m => m.kind === typescript_1.SyntaxKind.AbstractKeyword), parse_utilities_1.containsModifier(o, typescript_1.SyntaxKind.StaticKeyword), o.getStart(), o.getEnd()));
            }
            if (TypescriptGuards_1.isSetAccessorDeclaration(o)) {
                classDeclaration.accessors.push(new AccessorDeclaration_1.SetterDeclaration(o.name.text, parse_utilities_1.getNodeVisibility(o), parse_utilities_1.getNodeType(o, o.type), o.modifiers !== undefined && o.modifiers.some(m => m.kind === typescript_1.SyntaxKind.AbstractKeyword), parse_utilities_1.containsModifier(o, typescript_1.SyntaxKind.StaticKeyword), o.getStart(), o.getEnd()));
            }
            if (TypescriptGuards_1.isConstructorDeclaration(o)) {
                const ctor = new ConstructorDeclaration_1.ConstructorDeclaration(classDeclaration.name, o.getStart(), o.getEnd());
                parseCtorParams(classDeclaration, ctor, o);
                classDeclaration.ctor = ctor;
                function_parser_1.parseFunctionParts(tsResource, ctor, o);
            }
            else if (TypescriptGuards_1.isMethodDeclaration(o)) {
                const method = new MethodDeclaration_1.MethodDeclaration(o.name.text, o.modifiers !== undefined && o.modifiers.some(m => m.kind === typescript_1.SyntaxKind.AbstractKeyword), parse_utilities_1.getNodeVisibility(o), parse_utilities_1.getNodeType(o, o.type), !!o.questionToken, parse_utilities_1.containsModifier(o, typescript_1.SyntaxKind.StaticKeyword), parse_utilities_1.containsModifier(o, typescript_1.SyntaxKind.AsyncKeyword), o.getStart(), o.getEnd());
                method.parameters = function_parser_1.parseMethodParams(o);
                method.typeArguments = parseTypeArguments(o);
                classDeclaration.methods.push(method);
                function_parser_1.parseFunctionParts(tsResource, method, o);
            }
        });
    }
    parseClassIdentifiers(tsResource, node);
    tsResource.declarations.push(classDeclaration);
}
exports.parseClass = parseClass;
