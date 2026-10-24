require 'xcodeproj'
root = File.expand_path('../ios', __dir__)
project = Xcodeproj::Project.new(File.join(root, 'Eluva.xcodeproj'))
project.root_object.known_regions = ['en', 'fr', 'Base']
project.root_object.development_region = 'en'
app = project.new_target(:application, 'Eluva', :ios, '17.0')
group = project.main_group.new_group('Eluva', 'Eluva')
Dir.glob(File.join(root, 'Eluva', '*.swift')).sort.each { |path| app.source_build_phase.add_file_reference(group.new_file(File.basename(path))) }
['LaunchScreen.storyboard','Assets.xcassets'].each { |path| app.resources_build_phase.add_file_reference(group.new_file(path)) }
web = group.new_file('Web'); web.last_known_file_type = 'folder'; app.resources_build_phase.add_file_reference(web)
variant = group.new_variant_group('InfoPlist.strings')
['en','fr'].each do |lang|
  child = variant.new_file("#{lang}.lproj/InfoPlist.strings")
  child.name = lang
end
app.resources_build_phase.add_file_reference(variant)
app.add_system_frameworks(['StoreKit','UIKit','WebKit','PhotosUI','Photos','AVFoundation','AVFAudio','Speech','NaturalLanguage','SwiftUI','Translation','UserNotifications','CryptoKit','Security','ImageIO','UniformTypeIdentifiers'])
test_sources = Dir.glob(File.join(root, 'EluvaTests', '*.swift')).sort
tests = nil
unless test_sources.empty?
  tests = project.new_target(:unit_test_bundle, 'EluvaTests', :ios, '17.0')
  test_group = project.main_group.new_group('EluvaTests', 'EluvaTests')
  test_sources.each { |path| tests.source_build_phase.add_file_reference(test_group.new_file(File.basename(path))) }
  tests.add_dependency(app)
  tests.add_system_frameworks(['StoreKitTest', 'StoreKit'])
  fixture_paths = ['Fixtures/CommerceQA.storekit', '../../tests/fixtures/qa-video.mp4']
    .select { |path| File.file?(File.expand_path(path, File.join(root, 'EluvaTests'))) }
  unless fixture_paths.empty?
    fixture_group = test_group.new_group('Fixtures')
    fixture_paths.each { |path| tests.resources_build_phase.add_file_reference(fixture_group.new_file(path)) }
  end
end
[app, tests].compact.each do |target|
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
tests&.build_configurations&.each do |config|
  config.build_settings['PRODUCT_BUNDLE_IDENTIFIER'] = 'com.eluva.app.tests'
  config.build_settings['GENERATE_INFOPLIST_FILE'] = 'YES'
  config.build_settings['TEST_HOST'] = '$(BUILT_PRODUCTS_DIR)/Eluva.app/$(BUNDLE_EXECUTABLE_FOLDER_PATH)/Eluva'
  config.build_settings['BUNDLE_LOADER'] = '$(TEST_HOST)'
end
project.save
scheme = Xcodeproj::XCScheme.new
scheme.add_build_target(app)
scheme.add_test_target(tests) if tests
scheme.set_launch_target(app)
scheme.save_as(project.path, 'Eluva', true)
puts 'Generated Eluva UIKit project; App Store bundle identifier: com.eluva.app'
