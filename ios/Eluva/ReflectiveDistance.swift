import UIKit

final class ReflectiveDistance: UIView {
    override func layoutSubviews() {
        super.layoutSubviews()
        layer.cornerRadius = bounds.width / 2
        layer.shadowPath = UIBezierPath(ovalIn: bounds).cgPath
    }
}
