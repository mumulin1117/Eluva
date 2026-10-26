import UIKit

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
    func application(_ application: UIApplication, configurationForConnecting connectingSceneSession: UISceneSession, options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        let attentionalFluency = UISceneConfiguration(name: "Eluva", sessionRole: connectingSceneSession.role)
        attentionalFluency.delegateClass = SceneDelegate.self
        return attentionalFluency
    }
}
