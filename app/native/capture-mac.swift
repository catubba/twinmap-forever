import AppKit
import CoreMedia
import Darwin
import Foundation
import ScreenCaptureKit

private func fail(_ message: String) -> Never {
    FileHandle.standardError.write(Data((message + "\n").utf8))
    exit(1)
}

private struct Layout: Encodable {
    let width: Int
    let height: Int
    let scale: CGFloat
    let titleBar: CGFloat
    let topRows: Int
}

// The mapping holds a full snapshot, followed by the live bottom row and top search band.
// Separate opens of the lock file let flock protect both views without either process waiting.
private final class Frames: NSObject, SCStreamOutput, SCStreamDelegate {
    let queue = DispatchQueue(label: "twinmap.capture.frames")
    private let lockFD: Int32
    private let pixels: UnsafeMutableRawPointer
    private let layout: Layout
    private var announced = false
    private var pendingSnapshot: CVPixelBuffer?

    init(fd: Int32, lockFD: Int32, layout: Layout) {
        let bytes = layout.width * (layout.height + 1 + layout.topRows) * 4
        guard ftruncate(fd, off_t(bytes)) == 0,
            let mapped = mmap(nil, bytes, PROT_READ | PROT_WRITE, MAP_SHARED, fd, 0),
            mapped != MAP_FAILED else { fail("Could not allocate the shared capture frame (errno \(errno))") }
        self.pixels = mapped
        self.layout = layout
        self.lockFD = lockFD
    }

    func stream(_ stream: SCStream, didStopWithError error: Error) {
        fail("ScreenCaptureKit stream stopped: \(error.localizedDescription)")
    }

    func stream(_ stream: SCStream, didOutputSampleBuffer sample: CMSampleBuffer, of type: SCStreamOutputType) {
        guard type == .screen,
            let attachments = CMSampleBufferGetSampleAttachmentsArray(sample, createIfNecessary: false) as? [[SCStreamFrameInfo: Any]],
            let status = attachments.first?[.status] as? Int,
            status == SCFrameStatus.complete.rawValue || status == SCFrameStatus.started.rawValue,
            let image = sample.imageBuffer,
            CVPixelBufferGetWidth(image) == layout.width,
            CVPixelBufferGetHeight(image) == layout.height else { return }
        publish(image)
    }

    private func publish(_ image: CVPixelBuffer) {
        if announced {
            _ = copy(image, live: true, snapshot: false)
            let needsTimer = pendingSnapshot == nil
            pendingSnapshot = image
            // Publish the latest change even if the window goes static before the timer fires.
            if needsTimer { publishSnapshot(after: .milliseconds(200)) }
            return
        }
        guard copy(image, live: true, snapshot: true) else { return }
        announced = true
        // The pipe announces one layout, after pixels exist. It carries no image data.
        guard var message = try? JSONEncoder().encode(layout) else { fail("Could not encode the capture layout") }
        message.append(10)
        FileHandle.standardOutput.write(message)
    }

    private func publishSnapshot(after delay: DispatchTimeInterval) {
        queue.asyncAfter(deadline: .now() + delay) { [self] in
            guard let image = pendingSnapshot else { return }
            if copy(image, live: false, snapshot: true) {
                pendingSnapshot = nil
            } else {
                publishSnapshot(after: .milliseconds(15))
            }
        }
    }

    private func copy(_ image: CVPixelBuffer, live: Bool, snapshot: Bool) -> Bool {
        guard CVPixelBufferLockBaseAddress(image, .readOnly) == kCVReturnSuccess else { return false }
        defer { CVPixelBufferUnlockBaseAddress(image, .readOnly) }
        guard let source = CVPixelBufferGetBaseAddress(image), flock(lockFD, LOCK_EX | LOCK_NB) == 0 else { return false }
        let stride = CVPixelBufferGetBytesPerRow(image), row = layout.width * 4
        func copyRows(_ count: Int, to destination: UnsafeMutableRawPointer) {
            if stride == row {
                memcpy(destination, source, row * count)
            } else {
                for y in 0..<count { memcpy(destination + y * row, source + y * stride, row) }
            }
        }
        if snapshot { copyRows(layout.height, to: pixels) }
        if live {
            let rows = pixels + row * layout.height
            memcpy(rows, source + stride * (layout.height - 1), row)
            copyRows(layout.topRows, to: rows + row)
        }
        flock(lockFD, LOCK_UN)
        return true
    }
}

@main
struct Capture {
    @MainActor
    static func main() async {
        let args = CommandLine.arguments
        guard args.count == 3, let id = CGWindowID(args[1]), let fd = Int32(args[2]) else {
            fail("Expected a window ID and a shared frame descriptor")
        }
        // EOF also stops the stream when Electron crashes or is terminated.
        DispatchQueue.global().async {
            var byte: UInt8 = 0
            while read(STDIN_FILENO, &byte, 1) > 0 {}
            exit(0)
        }
        do {
            let content = try await SCShareableContent.excludingDesktopWindows(true, onScreenWindowsOnly: true)
            guard let window = content.windows.first(where: { $0.windowID == id }) else {
                fail("ScreenCaptureKit could not find window \(id)")
            }
            // A display filter that includes only the game window, cropped to the window's frame.
            // SCContentFilter(desktopIndependentWindow:) asserts inside SkyLight
            // (SLSGetDisplaysWithRect) for WoW in native fullscreen on macOS 27,
            // which killed the helper on every start; the display filter has no such path.
            let frame = window.frame
            guard frame.width > 0, frame.height > 0 else { fail("Window \(id) has an empty frame") }
            let onDisplays = content.displays.map { ($0, CGDisplayBounds($0.displayID).intersection(frame)) }
                .filter { !$0.1.isNull && $0.1.width > 0 && $0.1.height > 0 }
            guard let display = onDisplays.max(by: { $0.1.width * $0.1.height < $1.1.width * $1.1.height })?.0 else {
                fail("Window \(id) is not on any display")
            }
            let bounds = CGDisplayBounds(display.displayID)
            let filter = SCContentFilter(display: display, including: [window])
            let scale = CGFloat(filter.pointPixelScale)
            let width = Int((frame.width * scale).rounded())
            let height = Int((frame.height * scale).rounded())
            guard width > 0, height > 0 else { fail("ScreenCaptureKit returned an empty window") }
            let fullscreen = abs(frame.minX - bounds.minX) < 1 && abs(frame.minY - bounds.minY) < 1
                && abs(frame.width - bounds.width) < 1 && abs(frame.height - bounds.height) < 1
            let style: NSWindow.StyleMask = [.titled, .closable, .miniaturizable, .resizable]
            let standard = frame.height - NSWindow.contentRect(forFrameRect: frame, styleMask: style).height
            // The crop is the whole window frame, chrome included. Any strip found by Electron
            // refines this AppKit estimate when the game uses a custom window style.
            let titleBar = fullscreen ? 0 : max(0, standard)
            let topRows = min(height, max(Int((titleBar * scale).rounded()), Int(ceil(64 * scale))) + 1)
            let layout = Layout(width: width, height: height, scale: scale, titleBar: titleBar, topRows: topRows)
            let frames = Frames(fd: fd, lockFD: 3, layout: layout)

            let config = SCStreamConfiguration()
            config.width = width
            config.height = height
            config.captureResolution = .best
            config.pixelFormat = kCVPixelFormatType_32BGRA
            config.colorSpaceName = CGColorSpace.sRGB
            config.ignoreShadowsSingleWindow = true
            config.ignoreGlobalClipSingleWindow = true
            // The display filter clips at the display edge unless told not to (default false):
            // a window that hangs off the screen or spans displays would lose strip pixels.
            config.ignoreGlobalClipDisplay = true
            config.shouldBeOpaque = true
            config.showsCursor = false
            config.scalesToFit = false
            // Display-local points, the same top-left origin as CGDisplayBounds and SCWindow.frame.
            config.sourceRect = CGRect(x: frame.minX - bounds.minX, y: frame.minY - bounds.minY,
                                       width: frame.width, height: frame.height)
            config.minimumFrameInterval = CMTime(value: 1, timescale: 60)
            config.queueDepth = 3
            let stream = SCStream(filter: filter, configuration: config, delegate: frames)
            try stream.addStreamOutput(frames, type: .screen, sampleHandlerQueue: frames.queue)
            try await stream.startCapture()
            // Keep the stream and its output alive while the parent holds the pipe open.
            while true {
                try await Task.sleep(for: .seconds(3600))
                withExtendedLifetime((stream, frames)) {}
            }
        } catch {
            let reason = error as NSError
            fail("ScreenCaptureKit: \(reason.domain) \(reason.code): \(reason.localizedDescription)")
        }
    }
}
