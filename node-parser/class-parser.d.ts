import { ClassDeclaration, ConstructorDeclaration, MethodDeclaration, Node, PropertyDeclaration } from 'typescript';
import { ClassDeclaration as TshClass } from '../declarations/ClassDeclaration';
import { ConstructorDeclaration as TshConstructor } from '../declarations/ConstructorDeclaration';
import { ParameterDeclaration as TshParameter } from '../declarations/ParameterDeclaration';
import { PropertyDeclaration as TshProperty } from '../declarations/PropertyDeclaration';
import { Resource } from '../resources/Resource';
/**
 * Parses the identifiers of a class (usages).
 *
 * @export
 * @param {Resource} tsResource
 * @param {Node} node
 */
export declare function parseClassIdentifiers(tsResource: Resource, node: Node): void;
/**
 * Parse method parameters.
 *
 * @export
 * @param {(FunctionDeclaration | MethodDeclaration | MethodSignature)} node
 * @returns {TshParameter[]}
 */
export declare function parseTypeArguments(node: TshParameter | TshProperty | PropertyDeclaration | MethodDeclaration): TshParameter[] | string;
/**
 * Parse information about a constructor. Contains parameters and used modifiers
 * (i.e. constructor(private name: string)).
 *
 * @export
 * @param {TshClass} parent
 * @param {TshConstructor} ctor
 * @param {ConstructorDeclaration} node
 */
export declare function parseCtorParams(parent: TshClass, ctor: TshConstructor, node: ConstructorDeclaration): void;
/**
 * Parses a class node into its declaration. Calculates the properties, constructors and methods of the class.
 *
 * @export
 * @param {Resource} tsResource
 * @param {ClassDeclaration} node
 */
export declare function parseClass(tsResource: Resource, node: ClassDeclaration): void;
