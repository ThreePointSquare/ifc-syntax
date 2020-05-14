import { DocumentSymbol, SymbolKind, DocumentSymbolParams } from 'vscode-languageserver';
import { DocumentNode, AssignmentNode, VariableNode, ConstructorNode, SectionNode, FunctionNode } from 'ifc2ast/out/ast/nodes';
import { IVisitor } from 'ifc2ast/out/ast/visitor/IVisitor';
import { ASTNode, ASTRange } from 'ifc2ast/out/ast';
import { documents } from '../server';
import { Ifc2Ast } from 'ifc2ast';

export const processDocumentSymbols = async (params: DocumentSymbolParams) => {
    let doc = documents.get(params.textDocument.uri);
    let text = doc ? doc.getText() : null;
    if (text) {
        // Parse file`
        let d = await new Ifc2Ast().parseIfcFile(text.split('\n'), true).then(doc => {
            // Visit document
            let pv = new SymbolProvider().visit(doc);
            return pv as DocumentSymbol[];
        });
        return d;
    }
};

class SymbolProvider implements IVisitor {
    visit(node: ASTNode, ...data: any[]) {
        if (node instanceof AssignmentNode) {
            let name = node.name as VariableNode;
            let constructor = node.value as ConstructorNode;
            return DocumentSymbol.create(`#${name.id}`, constructor.name, SymbolKind.Field, this.convertRange(node.loc), this.convertRange(node.name.loc));
        }
        else if (node instanceof FunctionNode) {
            let name: any = node.name;
            return DocumentSymbol.create(name, '', SymbolKind.Key, this.convertRange(node.loc), this.convertRange(node.loc));
        }
        else if (node instanceof DocumentNode) {
            let secs: any[] = [];
            node.sections.forEach(sec => {
                let sectionResult = sec.accept(this);
                if (sectionResult) {
                    secs.push(sectionResult);
                }
            });
            return secs as DocumentSymbol[];
        }
        else if (node instanceof SectionNode) {
            let name: any = node.name;
            let description = {
                "DATA": "Data section",
                "HEADER": "Header section"
            }[name.text];
            let children: any[] = [];
            node.children.forEach(child => {
                let d = child.accept(this);
                if (d) {
                    children.push(d);
                }
            });
            return DocumentSymbol.create(name.text, description, SymbolKind.Namespace, this.convertRange(node.loc), this.convertRange(node.name.loc), children);
        }
        else {
            // console.log("Other node: " + node.constructor.name)
        }
    }
    convertRange(range: ASTRange) {
        return {
            start: { line: range.start.line - 1, character: range.start.character },
            end: { line: range.end.line - 1, character: range.end.character }
        };
    }
}
