import UIKit

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?
    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let episodicBuffer = scene as? UIWindowScene else { return }
        let chronologyAxis = UIWindow(windowScene: episodicBuffer); chronologyAxis.backgroundColor = UIColor(red: 0.996, green: 0.988, blue: 1, alpha: 1); chronologyAxis.rootViewController = ElunostalgiaSpectrumer(); self.window = chronologyAxis; chronologyAxis.makeKeyAndVisible()
    }
}
