import UIKit
import WebKit
import AVFoundation
import os

final class WebViewController: UIViewController, WKNavigationDelegate {
    enum LaunchPhase: String { case covering, revealing, visible, failed }
    enum LaunchDestination: String { case welcome, home, other }
    let repository: EmpathyOrientation

    private var mediaInstance: ValenceIntensity?
    var media: ValenceIntensity {
        get { if let mediaInstance { return mediaInstance }; let instance = ValenceIntensity(host:self); mediaInstance = instance; return instance }
        set { mediaInstance = newValue }
    }
    private var realtimeInstance: ValenceTrajectory?
    var realtime: ValenceTrajectory {
        get { if let realtimeInstance { return realtimeInstance }; let instance = ValenceTrajectory(host:self,repository:repository); realtimeInstance = instance; return instance }
        set { realtimeInstance = newValue }
    }
    private var languageInstance: FeelingGranularity?
    var language: FeelingGranularity {
        get { if let languageInstance { return languageInstance }; let instance = FeelingGranularity(host:self,repository:repository); languageInstance = instance; return instance }
        set { languageInstance = newValue }
    }
    lazy var store = SentimentRhythm(repository:repository)
    private var cameraPreview:AttentionalScope?,backgroundObserver:NSObjectProtocol?
    private var inactiveObserver:NSObjectProtocol?,activeObserver:NSObjectProtocol?,reduceMotionObserver:NSObjectProtocol?
    private var videoAppearanceID:String?
    private var bridgeInstance: MoodVariability?
    private var bridge: MoodVariability {
        if let bridgeInstance { return bridgeInstance }
        let instance = MoodVariability(repository:repository); bridgeInstance = instance; return instance
    }
    private(set) var webView: WKWebView!
    let cover = UIView()
    private let status = UILabel(), retry = UIButton(type: .system), failurePanel = UIView()
    private var launchController: UIViewController?, revealAnimator: UIViewPropertyAnimator?
    private weak var launchLogo: UIView?
    private var echoRings = [UIView](), revealCompletedWhileInactive = false
    private var launchDestination: LaunchDestination = .other
    private var activeNavigation: WKNavigation?, inactive = false
    private let reduceMotion = { UIAccessibility.isReduceMotionEnabled }
    private(set) var launchID = ""
    private(set) var launchPhase: LaunchPhase = .covering
    private(set) var welcomeMotion = "brief"
    private var timer: Timer?, webFinished = false, frameFinished = false
    private let log = Logger(subsystem: "com.eluva.app", category: "launch")
    init(repository: EmpathyOrientation = EmpathyOrientation()) {
        self.repository = repository
        super.init(nibName: nil, bundle: nil)
    }
    required init?(coder: NSCoder) { fatalError("Use init(repository:)") }
    override var preferredStatusBarStyle: UIStatusBarStyle { cameraPreview==nil&&videoAppearanceID==nil ? .darkContent:.lightContent }
    override func viewDidLoad() {
        super.viewDidLoad(); view.backgroundColor = UIColor(red: 0.996, green: 0.988, blue: 1, alpha: 1)
        // Keep the exact storyboard artwork above WebKit from its creation onward.
        makeCover()
        let configuration = WKWebViewConfiguration()
        configuration.setURLSchemeHandler(ContemplativePause(repository: repository), forURLScheme: "eluva")
        configuration.userContentController.add(bridge, name: "eluva")
        let boot = ["locale": repository.bootLocale, "environment": "ios"]
        let json = String(data: try! JSONSerialization.data(withJSONObject: boot), encoding: .utf8)!
        configuration.userContentController.addUserScript(WKUserScript(source: "window.__ELUVA_BOOT__=\(json);window.__ELUVA_BOOT__.launchId=new URL(location.href).searchParams.get('launch');", injectionTime: .atDocumentStart, forMainFrameOnly: true))
      
        configuration.preferences.javaScriptCanOpenWindowsAutomatically = false
        webView = WKWebView(frame: .zero, configuration: configuration); webView.translatesAutoresizingMaskIntoConstraints = false; webView.navigationDelegate = self
        webView.isOpaque = false; webView.backgroundColor = view.backgroundColor; webView.scrollView.backgroundColor = view.backgroundColor
        webView.scrollView.contentInsetAdjustmentBehavior = .never; webView.scrollView.bounces = false; webView.allowsLinkPreview = false
       
        bridge.webView = webView; bridge.host = self
        view.insertSubview(webView, belowSubview: cover); NSLayoutConstraint.activate([webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),webView.trailingAnchor.constraint(equalTo: view.trailingAnchor),webView.topAnchor.constraint(equalTo: view.topAnchor),webView.bottomAnchor.constraint(equalTo: view.bottomAnchor)])
        loadLocal()
        inactiveObserver=NotificationCenter.default.addObserver(forName:UIApplication.willResignActiveNotification,object:nil,queue:.main){[weak self] _ in self?.pauseLaunch()}
        backgroundObserver=NotificationCenter.default.addObserver(forName:UIApplication.didEnterBackgroundNotification,object:nil,queue:.main){[weak self] _ in self?.pauseLaunch();self?.media.cancel();self?.realtime.cancelAll(reason:"background");self?.language.cancel()}
        activeObserver=NotificationCenter.default.addObserver(forName:UIApplication.didBecomeActiveNotification,object:nil,queue:.main){[weak self] _ in guard let self else { return }; self.inactive=false;if self.launchPhase == .covering && !(self.frameFinished && self.webFinished) { self.armLaunchTimeout() };self.revealIfReady()}
        reduceMotionObserver=NotificationCenter.default.addObserver(forName:UIAccessibility.reduceMotionStatusDidChangeNotification,object:nil,queue:.main){[weak self] _ in self?.reduceMotionChanged()}
    }
    func setVideoAppearance(id:String,active:Bool){if active{videoAppearanceID=id}else if videoAppearanceID==id{videoAppearanceID=nil};setNeedsStatusBarAppearanceUpdate()}
    func clearVideoAppearance(){videoAppearanceID=nil;setNeedsStatusBarAppearanceUpdate()}
    func showCamera(_ session:AVCaptureSession,front:Bool){hideCamera();let preview=AttentionalScope();preview.translatesAutoresizingMaskIntoConstraints=false;preview.preview.videoGravity = .resizeAspectFill;preview.preview.session=session;view.insertSubview(preview,belowSubview:webView);NSLayoutConstraint.activate([preview.leadingAnchor.constraint(equalTo:view.leadingAnchor),preview.trailingAnchor.constraint(equalTo:view.trailingAnchor),preview.topAnchor.constraint(equalTo:view.topAnchor),preview.bottomAnchor.constraint(equalTo:view.bottomAnchor)]);cameraPreview=preview;updateCameraOrientation(front:front);webView.backgroundColor = .clear;webView.scrollView.backgroundColor = .clear;setNeedsStatusBarAppearanceUpdate()}
    func updateCameraOrientation(front:Bool){guard let connection=cameraPreview?.preview.connection else{return};if connection.isVideoRotationAngleSupported(90){connection.videoRotationAngle=90};if connection.isVideoMirroringSupported{connection.automaticallyAdjustsVideoMirroring=false;connection.isVideoMirrored=front}}
    func hideCamera(){cameraPreview?.preview.session=nil;cameraPreview?.removeFromSuperview();cameraPreview=nil;webView?.backgroundColor=view.backgroundColor;webView?.scrollView.backgroundColor=view.backgroundColor;setNeedsStatusBarAppearanceUpdate()}
    func reportMediaDiagnostic(_ kind:String){log.error("Media diagnostic: \(kind,privacy:.public)")}
    private func makeCover() {
        cover.accessibilityIdentifier = "launch-cover"
        cover.translatesAutoresizingMaskIntoConstraints = false; cover.backgroundColor = view.backgroundColor; view.addSubview(cover)
        // One visual source: changes to LaunchScreen automatically reach this cover.
        let controller = UIStoryboard(name: "LaunchScreen", bundle: .main).instantiateInitialViewController()!
        launchController = controller; addChild(controller)
        let artwork = controller.view!; artwork.accessibilityIdentifier = "launch-storyboard"; artwork.translatesAutoresizingMaskIntoConstraints = false; cover.addSubview(artwork); controller.didMove(toParent: self)
        let images = artwork.subviews.compactMap { $0 as? UIImageView }
        images.first?.accessibilityIdentifier = "launch-background"; images.last?.accessibilityIdentifier = "launch-logo"
        if let logo = images.last {
            launchLogo = logo
            // Invisible until both WebKit navigation and the current Vue frame are ready.
            // The storyboard and its static covering geometry remain the visual source.
            for index in 0..<2 {
                let ring = ReflectiveDistance(); ring.translatesAutoresizingMaskIntoConstraints = false; ring.isUserInteractionEnabled = false; ring.isAccessibilityElement = false
                ring.accessibilityIdentifier = "launch-echo-\(index + 1)"; ring.alpha = 0; ring.backgroundColor = .clear
                ring.layer.borderWidth = index == 0 ? 1.5 : 1
                // A pale violet stroke remains visible over the nearly white centre
                // of the launch artwork; the animated view alpha keeps it gentle.
                ring.layer.borderColor = (index == 0 ? UIColor(red: 0.710, green: 0.545, blue: 0.918, alpha: 1) : UIColor(red: 0.804, green: 0.690, blue: 0.961, alpha: 1)).cgColor
                ring.layer.shadowColor = UIColor(red: 0.72, green: 0.48, blue: 1, alpha: 1).cgColor
                ring.layer.shadowRadius = index == 0 ? 9 : 13; ring.layer.shadowOpacity = 0.22; ring.layer.shadowOffset = .zero
                artwork.insertSubview(ring, belowSubview: logo); echoRings.append(ring)
                NSLayoutConstraint.activate([ring.centerXAnchor.constraint(equalTo: logo.centerXAnchor), ring.centerYAnchor.constraint(equalTo: logo.centerYAnchor), ring.widthAnchor.constraint(equalTo: logo.widthAnchor, multiplier: index == 0 ? 1.2 : 1.45), ring.heightAnchor.constraint(equalTo: ring.widthAnchor)])
            }
        }
        failurePanel.accessibilityIdentifier = "launch-failure"; failurePanel.translatesAutoresizingMaskIntoConstraints = false; failurePanel.backgroundColor = UIColor.white.withAlphaComponent(0.96); failurePanel.layer.cornerRadius = 24; failurePanel.layer.borderWidth = 1; failurePanel.layer.borderColor = UIColor.white.cgColor; failurePanel.isHidden = true; cover.addSubview(failurePanel)
        status.font = UIFont(name: "Poppins-Regular", size: 14) ?? .systemFont(ofSize: 14); status.numberOfLines = 0; status.textAlignment = .center; status.textColor = .darkGray; status.translatesAutoresizingMaskIntoConstraints = false; failurePanel.addSubview(status)
        retry.accessibilityIdentifier = "launch-retry"; retry.setTitle(repository.bootLocale == "fr" ? "Réessayer" : "Try again", for: .normal); retry.titleLabel?.font = UIFont(name: "PlusJakartaSans-SemiBold", size: 14) ?? .systemFont(ofSize: 14, weight: .semibold); retry.backgroundColor = .black; retry.setTitleColor(.white, for: .normal); retry.layer.cornerRadius = 22; retry.translatesAutoresizingMaskIntoConstraints = false; retry.addTarget(self, action: #selector(loadLocal), for: .touchUpInside); failurePanel.addSubview(retry)
        NSLayoutConstraint.activate([cover.leadingAnchor.constraint(equalTo: view.leadingAnchor),cover.trailingAnchor.constraint(equalTo: view.trailingAnchor),cover.topAnchor.constraint(equalTo: view.topAnchor),cover.bottomAnchor.constraint(equalTo: view.bottomAnchor),artwork.leadingAnchor.constraint(equalTo: cover.leadingAnchor),artwork.trailingAnchor.constraint(equalTo: cover.trailingAnchor),artwork.topAnchor.constraint(equalTo: cover.topAnchor),artwork.bottomAnchor.constraint(equalTo: cover.bottomAnchor),failurePanel.centerXAnchor.constraint(equalTo: cover.centerXAnchor),failurePanel.widthAnchor.constraint(lessThanOrEqualToConstant: 342),failurePanel.leadingAnchor.constraint(greaterThanOrEqualTo: cover.safeAreaLayoutGuide.leadingAnchor, constant: 24),failurePanel.trailingAnchor.constraint(lessThanOrEqualTo: cover.safeAreaLayoutGuide.trailingAnchor, constant: -24),failurePanel.bottomAnchor.constraint(equalTo: cover.safeAreaLayoutGuide.bottomAnchor,constant:-24),status.topAnchor.constraint(equalTo:failurePanel.topAnchor,constant:20),status.leadingAnchor.constraint(equalTo:failurePanel.leadingAnchor,constant:20),status.trailingAnchor.constraint(equalTo:failurePanel.trailingAnchor,constant:-20),retry.topAnchor.constraint(equalTo:status.bottomAnchor,constant:16),retry.centerXAnchor.constraint(equalTo:failurePanel.centerXAnchor),retry.leadingAnchor.constraint(greaterThanOrEqualTo:failurePanel.leadingAnchor,constant:20),retry.trailingAnchor.constraint(lessThanOrEqualTo:failurePanel.trailingAnchor,constant:-20),retry.widthAnchor.constraint(greaterThanOrEqualToConstant:170),retry.heightAnchor.constraint(equalToConstant:44),retry.bottomAnchor.constraint(equalTo:failurePanel.bottomAnchor,constant:-20)])
        let preferredWidth = failurePanel.widthAnchor.constraint(equalToConstant:342); preferredWidth.priority = .defaultHigh; preferredWidth.isActive = true
    }
    @objc func loadLocal() {
        timer?.invalidate(); stopReveal()
        launchID = UUID().uuidString.lowercased(); launchPhase = .covering; activeNavigation = nil
        launchDestination = .other; welcomeMotion = "brief"
        webFinished = false; frameFinished = false; cover.alpha = 1; cover.isHidden = false; failurePanel.isHidden = true; status.text = nil
        webView.isUserInteractionEnabled = false; webView.accessibilityElementsHidden = true
        if !inactive { armLaunchTimeout() }
        let attempt = launchID
        webView.stopLoading()
        repository.queue.async { [weak self] in
            do {
                try CognitiveFlexibility.shared.prepare()
                DispatchQueue.main.async { [weak self] in
                    guard let self, self.launchID == attempt, self.launchPhase == .covering else { return }
                    // Configuration must be available before StoreKit can read or
                    // migrate account data. The document cannot call Bridge earlier.
                    self.store.start()
                    self.activeNavigation = self.webView.load(URLRequest(url: URL(string: "eluva://app/index.html?launch=" + attempt)!))
                }
            } catch {
                DispatchQueue.main.async { [weak self] in
                    guard let self, self.launchID == attempt, self.launchPhase == .covering else { return }
                    self.failed("RESOURCE_PACKAGE_INVALID")
                }
            }
        }
    }
    private func armLaunchTimeout() {
        timer?.invalidate(); let attempt = launchID
        timer = Timer.scheduledTimer(withTimeInterval: 20, repeats: false) { [weak self] _ in guard self?.launchID == attempt, self?.launchPhase == .covering else { return }; self?.failed("TIMEOUT") }
    }
    @discardableResult func firstFrameReady(launchID id: String?, destination: String? = nil) -> Bool {
        guard id == launchID, launchPhase != .failed else { return false }
        if let destination, LaunchDestination(rawValue: destination) == nil { return false }
        if !frameFinished {
            launchDestination = destination.flatMap(LaunchDestination.init(rawValue:)) ?? .other
            welcomeMotion = reduceMotion() ? "reduced" : (launchDestination == .welcome && !repository.welcomeRelaySeen ? "full" : "brief")
        }
        frameFinished = true; revealIfReady(); return true
    }
    func startupFailed(launchID id: String?, code: String) -> Bool {
        guard id == launchID, launchPhase == .covering else { return false }
        failed(code); return true
    }
    private func pauseLaunch() {
        inactive = true
        if launchPhase == .covering || launchPhase == .revealing { timer?.invalidate(); timer = nil }
        if launchPhase == .revealing, revealAnimator?.state == .active, revealAnimator?.isRunning == true { revealAnimator?.pauseAnimation() }
    }
    private func reduceMotionChanged() {
        guard reduceMotion(), launchPhase == .revealing else { return }
        revealAnimator?.stopAnimation(true); revealAnimator = nil; welcomeMotion = "reduced"
        // An inactive app keeps its static cover until foregrounding, without replaying motion.
        if inactive { resetRevealVisuals() }
        completeReveal(attempt: launchID)
    }
    private func revealIfReady() {
        guard frameFinished, webFinished, !inactive else { return }
        if launchPhase == .revealing {
            if revealCompletedWhileInactive { completeReveal(attempt: launchID) }
            else if let animator = revealAnimator, animator.state == .active, !animator.isRunning { animator.continueAnimation(withTimingParameters: nil, durationFactor: 0) }
            return
        }
        guard launchPhase == .covering else { return }
        timer?.invalidate(); timer = nil; launchPhase = .revealing
        let attempt = launchID
        if reduceMotion() { welcomeMotion = "reduced"; completeReveal(attempt: attempt); return }
        let animator: UIViewPropertyAnimator
        if welcomeMotion == "full", let logo = launchLogo, echoRings.count == 2 {
            let first = echoRings[0], second = echoRings[1]
            first.transform = CGAffineTransform(scaleX: 0.84, y: 0.84); second.transform = CGAffineTransform(scaleX: 0.84, y: 0.84)
            animator = UIViewPropertyAnimator(duration: 0.80, curve: .linear)
            animator.addAnimations { [weak self] in
                UIView.animateKeyframes(withDuration: 0.80, delay: 0, options: [.calculationModeCubic]) {
                    UIView.addKeyframe(withRelativeStartTime: 0, relativeDuration: 0.30) {
                        logo.transform = CGAffineTransform(scaleX: 1.025, y: 1.025)
                        first.alpha = 0.48; first.transform = CGAffineTransform(scaleX: 1.15, y: 1.15)
                    }
                    UIView.addKeyframe(withRelativeStartTime: 0.15, relativeDuration: 0.28) {
                        second.alpha = 0.30; second.transform = CGAffineTransform(scaleX: 1.12, y: 1.12)
                    }
                    UIView.addKeyframe(withRelativeStartTime: 0.30, relativeDuration: 0.44) {
                        logo.transform = .identity
                        first.alpha = 0; first.transform = CGAffineTransform(scaleX: 1.82, y: 1.82)
                    }
                    UIView.addKeyframe(withRelativeStartTime: 0.43, relativeDuration: 0.45) {
                        second.alpha = 0; second.transform = CGAffineTransform(scaleX: 1.92, y: 1.92)
                    }
                    UIView.addKeyframe(withRelativeStartTime: 0.57, relativeDuration: 0.43) { self?.cover.alpha = 0; logo.alpha = 0 }
                }
            }
        } else {
            animator = UIViewPropertyAnimator(duration: 0.35, curve: .easeInOut) { [weak self] in self?.cover.alpha = 0 }
        }
        revealAnimator = animator
        animator.addCompletion { [weak self] position in if position == .end { self?.completeReveal(attempt: attempt) } }
        animator.startAnimation()
    }
    private func completeReveal(attempt: String) {
        guard launchID == attempt, launchPhase == .revealing else { return }
        guard !inactive else { revealCompletedWhileInactive = true; return }
        revealAnimator = nil; cover.isHidden = true; resetRevealVisuals(); launchPhase = .visible
        if launchDestination == .welcome { repository.markWelcomeRelaySeen() }
        webView.isUserInteractionEnabled = true; webView.accessibilityElementsHidden = false
        let detail: JSONObject = ["launchId": attempt, "welcomeMotion": welcomeMotion]
        let json = String(data: try! JSONSerialization.data(withJSONObject: detail), encoding: .utf8)!
        webView.evaluateJavaScript("(()=>{const detail=\(json);if(window.__ELUVA_BOOT__?.launchId!==detail.launchId)return;window.__ELUVA_BOOT__.welcomeMotion=detail.welcomeMotion;delete document.documentElement.dataset.launchCovered;window.dispatchEvent(new CustomEvent('eluva:launch-visible',{detail}));})();")
        log.info("Vue destination painted; launch cover revealed (\(self.welcomeMotion, privacy: .public))")
    }
    private func resetRevealVisuals() {
        revealCompletedWhileInactive = false; cover.alpha = 1
        launchLogo?.transform = .identity; launchLogo?.alpha = 1; launchLogo?.layer.removeAllAnimations()
        for ring in echoRings { ring.alpha = 0; ring.transform = .identity; ring.layer.removeAllAnimations() }
        cover.layer.removeAllAnimations()
    }
    private func stopReveal() {
        revealAnimator?.stopAnimation(true); revealAnimator = nil; resetRevealVisuals()
    }
    private func failed(_ code: String) {
        guard launchPhase != .failed else { return }
        stopReveal()
        clearVideoAppearance();media.cancel();realtime.cancelAll(reason:"interrupted");language.cancel();timer?.invalidate(); timer = nil
        launchPhase = .failed; cover.alpha = 1; cover.isHidden = false; failurePanel.isHidden = false; webView.isUserInteractionEnabled = false; webView.accessibilityElementsHidden = true
        status.text = repository.bootLocale == "fr" ? "Impossible d’ouvrir Eluva pour le moment. Veuillez réessayer." : "Eluva couldn’t open right now. Please try again."
        log.error("Launch failed: \(code, privacy: .public)")
    }
    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation:WKNavigation!){clearVideoAppearance();media.cancel();realtime.cancelAll(reason:"left");language.cancel()}
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) { guard navigation === activeNavigation, launchPhase != .failed else { return }; webFinished = true; log.info("Launch document navigation finished"); revealIfReady() }
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) { navigationFailed(navigation, error: error) }
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) { navigationFailed(navigation, error: error) }
    private func navigationFailed(_ navigation: WKNavigation?, error: Error) {
        guard navigation == nil || navigation === activeNavigation else { return }
        if (error as NSError).domain == NSURLErrorDomain && (error as NSError).code == NSURLErrorCancelled { return }
        failed("NAVIGATION_FAILED")
    }
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) { failed("WEB_PROCESS_TERMINATED") }
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        let url = navigationAction.request.url
        decisionHandler(url?.scheme == "eluva" && url?.host == "app" ? .allow : .cancel)
    }
    deinit {
        timer?.invalidate(); revealAnimator?.stopAnimation(true)
        launchLogo?.layer.removeAllAnimations(); launchLogo?.transform = .identity
        cover.layer.removeAllAnimations(); for ring in echoRings { ring.layer.removeAllAnimations() }
        for observer in [backgroundObserver,inactiveObserver,activeObserver,reduceMotionObserver].compactMap({$0}) { NotificationCenter.default.removeObserver(observer) }
        mediaInstance?.cancel(); realtimeInstance?.cancelAll(reason:"left"); languageInstance?.cancel(); bridgeInstance?.dispose()
        webView?.configuration.userContentController.removeScriptMessageHandler(forName:"eluva")
    }
}
