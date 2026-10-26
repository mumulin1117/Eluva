require 'xcodeproj'
root = File.expand_path('../ios', __dir__)
project = Xcodeproj::Project.new(File.join(root, 'Eluva.xcodeproj'))
project.root_object.known_regions = ['en', 'fr', 'Base']
project.root_object.development_region = 'en'
app = project.new_target(:application, 'Eluva', :ios, '17.0')
group = project.main_group.new_group('Eluva', 'Eluva')
Dir.glob(File.join(root, 'Eluva', '*.swift')).sort.each { |path| app.source_build_phase.add_file_reference(group.new_file(File.basename(path))) }
['LaunchScreen.storyboard','Assets.xcassets'].each { |path| app.resources_build_phase.add_file_reference(group.new_file(path)) }
['PerceptualEluOpenness', 'NativeFonts', 'Licenses'].each do |path|
  resource = group.new_file(path); resource.last_known_file_type = 'folder'
  app.resources_build_phase.add_file_reference(resource)
end
variant = group.new_variant_group('InfoPlist.strings')
['en','fr'].each do |lang|
  child = variant.new_file("#{lang}.lproj/InfoPlist.strings")
  child.name = lang
end
app.resources_build_phase.add_file_reference(variant)
app.add_system_frameworks(['StoreKit','UIKit','WebKit','PhotosUI','Photos','AVFoundation','AVFAudio','Speech','NaturalLanguage','SwiftUI','Translation','UserNotifications','CryptoKit','Security','ImageIO','UniformTypeIdentifiers'])
# Resolve against the selected SDK, never the generator machine's SDK version.
app.frameworks_build_phase.files_references.each do |framework|
  framework.path = "System/Library/Frameworks/#{File.basename(framework.path)}"
  framework.source_tree = 'SDKROOT'
end
[app].each do |target|
  target.build_configurations.each do |config|
    settings = config.build_settings
    settings['SWIFT_VERSION'] = '5.0'
    settings['SWIFT_STRICT_CONCURRENCY'] = 'targeted'
    settings['TARGETED_DEVICE_FAMILY'] = '1'
    settings['SUPPORTED_PLATFORMS'] = 'iphoneos iphonesimulator'
    settings['CODE_SIGN_STYLE'] = 'Automatic'
    settings['ENABLE_USER_SCRIPT_SANDBOXING'] = 'YES'
    settings['IPHONEOS_DEPLOYMENT_TARGET'] = '17.0'
    settings['PRODUCT_NAME'] = '$(TARGET_NAME)'
    settings['SWIFT_OPTIMIZATION_LEVEL'] = config.name == 'Debug' ? '-Onone' : '-O'
    settings['DEBUG_INFORMATION_FORMAT'] = 'dwarf-with-dsym'
    settings['SWIFT_ACTIVE_COMPILATION_CONDITIONS'] = config.name == 'Debug' ? 'DEBUG' : ''
  end
end
app.build_configurations.each do |config|
  config.build_settings['ASSETCATALOG_COMPILER_APPICON_NAME'] = 'AppIcon'
  config.build_settings.delete('ASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME')
  config.build_settings['PRODUCT_BUNDLE_IDENTIFIER'] = 'com.eluva.app'
  config.build_settings['INFOPLIST_FILE'] = 'Eluva/Info.plist'
  config.build_settings['GENERATE_INFOPLIST_FILE'] = 'NO'
  config.build_settings['CODE_SIGN_ENTITLEMENTS[sdk=iphonesimulator*]'] = 'Eluva/Simulator.entitlements'
  config.build_settings['CODE_SIGN_IDENTITY[sdk=iphonesimulator*]'] = '-'
end
project.save
scheme = Xcodeproj::XCScheme.new
scheme.add_build_target(app)
scheme.set_launch_target(app)
scheme.save_as(project.path, 'Eluva', true)
puts 'Generated Eluva UIKit project; App Store bundle identifier: com.eluva.app'
