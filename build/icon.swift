// Icônes : un anneau clair (la boucle) et un point bleu (la tête de lecture) sur fond presque noir.
//   swift build/icon.swift   (depuis la racine du dépôt)
import Foundation
import AppKit

func c(_ hex: UInt32) -> CGColor {
    CGColor(red: CGFloat((hex >> 16) & 0xFF)/255, green: CGFloat((hex >> 8) & 0xFF)/255,
            blue: CGFloat(hex & 0xFF)/255, alpha: 1)
}

func draw(_ s: CGFloat, _ chemin: String) {
    let x = CGContext(data: nil, width: Int(s), height: Int(s), bitsPerComponent: 8, bytesPerRow: 0,
                      space: CGColorSpaceCreateDeviceRGB(),
                      bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
    x.setShouldAntialias(true)
    x.setFillColor(c(0x171716))
    x.fill(CGRect(x: 0, y: 0, width: s, height: s))
    let r = s * 0.25, cx = s / 2, cy = s / 2
    x.setStrokeColor(c(0xECEBE7))
    x.setLineWidth(s * 0.075)
    x.setLineCap(.round)
    // anneau ouvert en haut, comme une reprise qui revient au début
    x.addArc(center: CGPoint(x: cx, y: cy), radius: r, startAngle: .pi / 2 - 0.42, endAngle: .pi / 2 + 0.42, clockwise: true)
    x.strokePath()
    x.setFillColor(c(0x7298F2))
    let d = s * 0.11
    x.fillEllipse(in: CGRect(x: cx - d/2, y: cy + r - d/2, width: d, height: d))
    let rep = NSBitmapImageRep(cgImage: x.makeImage()!)
    try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: chemin))
}
for (t, n) in [(512, "icon-512"), (192, "icon-192"), (180, "apple-touch-icon"), (32, "favicon-32")] {
    draw(CGFloat(t), "icons/\(n).png")
}
print("icônes écrites dans icons/")
