// Generates an explicitly synthetic, silent one-second video for local media QA.
import Foundation
import AVFoundation
import CoreVideo
let output=URL(fileURLWithPath:CommandLine.arguments.dropFirst().first ?? "tests/fixtures/qa-video.mp4")
if FileManager.default.fileExists(atPath:output.path){exit(0)}
let writer=try AVAssetWriter(outputURL:output,fileType:.mp4)
let input=AVAssetWriterInput(mediaType:.video,outputSettings:[AVVideoCodecKey:AVVideoCodecType.h264,AVVideoWidthKey:320,AVVideoHeightKey:240])
let adapter=AVAssetWriterInputPixelBufferAdaptor(assetWriterInput:input,sourcePixelBufferAttributes:[kCVPixelBufferPixelFormatTypeKey as String:kCVPixelFormatType_32ARGB,kCVPixelBufferWidthKey as String:320,kCVPixelBufferHeightKey as String:240])
writer.add(input);writer.startWriting();writer.startSession(atSourceTime:.zero)
for frame in 0..<24 {
 while !input.isReadyForMoreMediaData {Thread.sleep(forTimeInterval:0.005)}
 var pixel:CVPixelBuffer?;CVPixelBufferCreate(kCFAllocatorDefault,320,240,kCVPixelFormatType_32ARGB,nil,&pixel)
 CVPixelBufferLockBaseAddress(pixel!,[]);let row=CVPixelBufferGetBytesPerRow(pixel!),p=CVPixelBufferGetBaseAddress(pixel!)!.assumingMemoryBound(to:UInt8.self)
 for y in 0..<240 {for x in 0..<320 {let n=y*row+x*4;p[n]=255;p[n+1]=UInt8(119+frame*3);p[n+2]=UInt8(50+y/3);p[n+3]=255}}
 CVPixelBufferUnlockBaseAddress(pixel!,[]);adapter.append(pixel!,withPresentationTime:CMTime(value:Int64(frame),timescale:24))
}
input.markAsFinished();let done=DispatchSemaphore(value:0);writer.finishWriting{done.signal()};done.wait()
guard writer.status == .completed else{throw writer.error!};print(output.path)
