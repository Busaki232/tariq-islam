import Foundation
import UIKit
import Capacitor
import PushKit
import CallKit
import AVFoundation

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate, PKPushRegistryDelegate, CXProviderDelegate {

    var window: UIWindow?

    private let provider: CXProvider = {
        let config = CXProviderConfiguration(localizedName: "Tariq Islam")
        config.supportsVideo = true
        config.maximumCallsPerCallGroup = 1
        config.maximumCallGroups = 1
        config.includesCallsInRecents = false
        return CXProvider(configuration: config)
    }()

    let callController = CXCallController()

    var voipRegistry: PKPushRegistry?
    var latestVoipToken: String?

    private var activeCallUUID: UUID?
    private var pendingCallUrl: URL?
    private var pendingCallerName: String?

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
    ) -> Bool {
        print("App launched")
        setupPushKit()
        setupCallKit()
        print("PushKit + CallKit setup finished")
        return true
    }

    func setupPushKit() {
        print("Starting PushKit registration")
        voipRegistry = PKPushRegistry(queue: DispatchQueue.main)
        voipRegistry?.delegate = self
        voipRegistry?.desiredPushTypes = [.voIP]
        print("PushKit desiredPushTypes set to voIP")
    }

    func setupCallKit() {
        print("Setting up CallKit")
        provider.setDelegate(self, queue: nil)
        print("CallKit delegate set")
    }

    func pushRegistry(
        _ registry: PKPushRegistry,
        didUpdate pushCredentials: PKPushCredentials,
        for type: PKPushType
    ) {
        let token = pushCredentials.token.map { String(format: "%02x", $0) }.joined()
        latestVoipToken = token
        print("VoIP token: \(token)")
        print("Push type updated: \(type.rawValue)")
        saveVoipTokenToBackend(token)
    }

    func pushRegistry(
        _ registry: PKPushRegistry,
        didInvalidatePushTokenFor type: PKPushType
    ) {
        print("VoIP token invalidated for type: \(type.rawValue)")
    }

    func pushRegistry(
        _ registry: PKPushRegistry,
        didReceiveIncomingPushWith payload: PKPushPayload,
        for type: PKPushType,
        completion: @escaping () -> Void
    ) {
        print("Incoming VoIP push received")
        print("Push payload: \(payload.dictionaryPayload)")

        let payloadData = payload.dictionaryPayload
        let callerName = extractCallerName(from: payloadData) ?? "Incoming Call"
        let callType = extractCallType(from: payloadData) ?? "video"
        let callUrl = buildCallUrl(from: payloadData)

        if let callUrl {
            pendingCallUrl = callUrl
            print("Saved pendingCallUrl: \(callUrl.absoluteString)")
        } else {
            print("No valid call URL found in VoIP payload")
        }

        pendingCallerName = callerName

        let uuid = UUID()
        activeCallUUID = uuid

        let update = CXCallUpdate()
        update.localizedCallerName = callerName
        update.hasVideo = (callType.lowercased() == "video")

        provider.reportNewIncomingCall(with: uuid, update: update) { error in
            if let error = error {
                print("CallKit error: \(error.localizedDescription)")
            } else {
                print("Incoming call reported to CallKit")
            }
            completion()
        }
    }

    func providerDidReset(_ provider: CXProvider) {
        print("CallKit provider reset")
        activeCallUUID = nil
        pendingCallUrl = nil
        pendingCallerName = nil
    }

    func provider(_ provider: CXProvider, perform action: CXAnswerCallAction) {
        print("Call answered from CallKit")

        if let callUrl = pendingCallUrl {
            print("Opening pending call URL after answer: \(callUrl.absoluteString)")
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
                UIApplication.shared.open(callUrl, options: [:]) { success in
                    print("Open call URL success: \(success)")
                }
            }
        } else {
            print("No pendingCallUrl available on answer")
        }

        action.fulfill()
    }

    func provider(_ provider: CXProvider, perform action: CXEndCallAction) {
        print("Call ended from CallKit")
        activeCallUUID = nil
        pendingCallUrl = nil
        pendingCallerName = nil
        action.fulfill()
    }

    func provider(_ provider: CXProvider, didActivate audioSession: AVAudioSession) {
        print("Audio session activated")
    }

    func provider(_ provider: CXProvider, didDeactivate audioSession: AVAudioSession) {
        print("Audio session deactivated")
    }

    func application(
        _ app: UIApplication,
        open url: URL,
        options: [UIApplication.OpenURLOptionsKey: Any] = [:]
    ) -> Bool {
        print("application open url: \(url.absoluteString)")
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(
        _ application: UIApplication,
        continue userActivity: NSUserActivity,
        restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void
    ) -> Bool {
        return ApplicationDelegateProxy.shared.application(
            application,
            continue: userActivity,
            restorationHandler: restorationHandler
        )
    }

    private func extractCallerName(from payload: [AnyHashable: Any]) -> String? {
        if let callerName = payload["callerName"] as? String, !callerName.isEmpty { return callerName }
        if let callerName = payload["caller_name"] as? String, !callerName.isEmpty { return callerName }

        if let data = payload["data"] as? [String: Any] {
            if let callerName = data["callerName"] as? String, !callerName.isEmpty { return callerName }
            if let callerName = data["caller_name"] as? String, !callerName.isEmpty { return callerName }
        }

        return nil
    }

    private func extractCallType(from payload: [AnyHashable: Any]) -> String? {
        if let callType = payload["callType"] as? String, !callType.isEmpty { return callType }
        if let callType = payload["call_type"] as? String, !callType.isEmpty { return callType }

        if let data = payload["data"] as? [String: Any] {
            if let callType = data["callType"] as? String, !callType.isEmpty { return callType }
            if let callType = data["call_type"] as? String, !callType.isEmpty { return callType }
        }

        return nil
    }

    private func buildCallUrl(from payload: [AnyHashable: Any]) -> URL? {
        if let direct = extractDirectCallUrl(from: payload) {
            return direct
        }

        let merged = flattenedPayload(from: payload)

        guard
            let inviteId = merged["inviteId"] ?? merged["invite_id"],
            let roomUrl = merged["roomUrl"] ?? merged["room_url"]
        else {
            return nil
        }

        let callType = merged["callType"] ?? merged["call_type"] ?? "video"
        let conversationId = merged["conversationId"] ?? merged["conversation_id"] ?? ""
        let callerId = merged["callerId"] ?? merged["caller_id"] ?? ""
        let callerName = merged["callerName"] ?? merged["caller_name"] ?? ""

        var comps = URLComponents()
        comps.scheme = "tariqislam"
        comps.host = "call"
        comps.queryItems = [
            URLQueryItem(name: "inviteId", value: inviteId),
            URLQueryItem(name: "roomUrl", value: roomUrl),
            URLQueryItem(name: "callType", value: callType),
            URLQueryItem(name: "conversationId", value: conversationId),
            URLQueryItem(name: "callerId", value: callerId),
            URLQueryItem(name: "callerName", value: callerName)
        ]

        return comps.url
    }

    private func extractDirectCallUrl(from payload: [AnyHashable: Any]) -> URL? {
        let merged = flattenedPayload(from: payload)

        if let raw = merged["deeplink"], let url = URL(string: raw) {
            return normalizeCallUrl(url)
        }

        if let raw = merged["call_url"] {
            if raw.hasPrefix("#/") {
                let converted = "tariqislam://\(raw.dropFirst(2))"
                return URL(string: converted)
            }
            if raw.hasPrefix("/call?") {
                let converted = "tariqislam://call?\(raw.dropFirst("/call?".count))"
                return URL(string: converted)
            }
            if raw.hasPrefix("call?") {
                let converted = "tariqislam://call?\(raw.dropFirst("call?".count))"
                return URL(string: converted)
            }
            if let url = URL(string: raw) {
                return normalizeCallUrl(url)
            }
        }

        return nil
    }

    private func normalizeCallUrl(_ url: URL) -> URL {
        return url
    }

    private func flattenedPayload(from payload: [AnyHashable: Any]) -> [String: String] {
        var result: [String: String] = [:]

        for (key, value) in payload {
            if let k = key as? String {
                if let s = value as? String {
                    result[k] = s
                } else {
                    result[k] = String(describing: value)
                }
            }
        }

        if let data = payload["data"] as? [String: Any] {
            for (k, v) in data {
                if let s = v as? String {
                    result[k] = s
                } else {
                    result[k] = String(describing: v)
                }
            }
        }

        return result
    }

    func saveVoipTokenToBackend(_ token: String, attempt: Int = 0) {
        let defaults = UserDefaults.standard
        print("UserDefaults keys:", Array(defaults.dictionaryRepresentation().keys).filter {
            $0.contains("current_user_id") || $0.contains("Capacitor")
        })

        let userId =
            defaults.string(forKey: "current_user_id") ??
            defaults.string(forKey: "CapacitorStorage.current_user_id") ??
            defaults.string(forKey: "CapacitorPreferences.current_user_id")

        guard let userId, !userId.isEmpty else {
            if attempt < 10 {
                print("No current_user_id found, retrying VoIP token save in 1s (attempt \(attempt + 1))")
                DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) { [weak self] in
                    self?.saveVoipTokenToBackend(token, attempt: attempt + 1)
                }
            } else {
                print("No current_user_id found after retries, giving up VoIP token save")
            }
            return
        }

        guard
            let supabaseUrl = Bundle.main.object(forInfoDictionaryKey: "SUPABASE_URL") as? String,
            let anonKey = Bundle.main.object(forInfoDictionaryKey: "SUPABASE_ANON_KEY") as? String,
            let url = URL(string: "\(supabaseUrl)/functions/v1/save-voip-token")
        else {
            print("Missing SUPABASE_URL or SUPABASE_ANON_KEY in Info.plist")
            return
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(anonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(anonKey)", forHTTPHeaderField: "Authorization")

        let body: [String: Any] = [
            "user_id": userId,
            "token": token,
            "platform": "ios_voip"
        ]

        request.httpBody = try? JSONSerialization.data(withJSONObject: body)

        URLSession.shared.dataTask(with: request) { data, response, error in
            if let error = error {
                print("save-voip-token request failed: \(error.localizedDescription)")
                return
            }

            if let http = response as? HTTPURLResponse {
                print("save-voip-token status: \(http.statusCode)")
            }

            if let data = data, let text = String(data: data, encoding: .utf8) {
                print("save-voip-token response: \(text)")
            }
        }.resume()
    }
}