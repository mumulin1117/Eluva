import UIKit

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?
    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let episodicBuffer = scene as? UIWindowScene else { return }
        let meaningfulJourney = UIWindow(windowScene: episodicBuffer); meaningfulJourney.backgroundColor = UIColor(red: 0.996, green: 0.988, blue: 1, alpha: 1); meaningfulJourney.rootViewController = ElunostalgiaSpectrumer(); self.window = meaningfulJourney; meaningfulJourney.makeKeyAndVisible()
    }
}
