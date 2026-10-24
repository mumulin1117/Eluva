import Foundation
import CoreText
let root=URL(fileURLWithPath:FileManager.default.currentDirectoryPath).appendingPathComponent("public/fonts")
let characters=Array("ÀÂÆÇÈÉÊËÎÏÔŒÙÛÜŸàâæçèéêëîïôœùûüÿ’…".utf16)
var rows=[[String:Any]]()
for file in try FileManager.default.contentsOfDirectory(at:root,includingPropertiesForKeys:nil).filter({$0.pathExtension=="ttf"}).sorted(by:{$0.lastPathComponent<$1.lastPathComponent}) {
 let descriptors=CTFontManagerCreateFontDescriptorsFromURL(file as CFURL) as? [CTFontDescriptor] ?? []
 guard let descriptor=descriptors.first else{continue}
 let font=CTFontCreateWithFontDescriptor(descriptor,16,nil)
 var glyphs=[CGGlyph](repeating:0,count:characters.count)
 CTFontGetGlyphsForCharacters(font,characters,&glyphs,characters.count)
 let missing=zip(characters,glyphs).filter{$0.1==0}.map{String(UnicodeScalar($0.0)!)}
 rows.append(["file":"fonts/"+file.lastPathComponent,"family":CTFontCopyFamilyName(font) as String,"postScript":CTFontCopyPostScriptName(font) as String,"traits":CTFontCopyTraits(font),"variationAxes":CTFontCopyVariationAxes(font) as? [[String:Any]] ?? [],"missingFrenchCharacters":missing])
}
let data=try JSONSerialization.data(withJSONObject:rows,options:[.prettyPrinted,.sortedKeys])
try data.write(to:URL(fileURLWithPath:"docs/evidence/p7/font-inventory.json"))
for row in rows{print(row["file"]!,row["postScript"]!,row["traits"]!,"missing:",row["missingFrenchCharacters"]!)}
