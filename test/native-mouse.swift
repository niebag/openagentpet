import CoreGraphics
import Darwin
import Foundation

let arguments = CommandLine.arguments
guard arguments.count == 4 || arguments.count == 6,
      let startX = Double(arguments[2]),
      let startY = Double(arguments[3]) else {
  exit(64)
}

let source = CGEventSource(stateID: .hidSystemState)
let start = CGPoint(x: startX, y: startY)
CGEvent(mouseEventSource: source, mouseType: .leftMouseDown, mouseCursorPosition: start,
        mouseButton: .left)?.post(tap: .cghidEventTap)

if arguments[1] == "drag", arguments.count == 6,
   let endX = Double(arguments[4]), let endY = Double(arguments[5]) {
  usleep(100_000)
  for step in 1...10 {
    let fraction = Double(step) / 10
    let point = CGPoint(x: startX + (endX - startX) * fraction,
                        y: startY + (endY - startY) * fraction)
    CGEvent(mouseEventSource: source, mouseType: .leftMouseDragged,
            mouseCursorPosition: point, mouseButton: .left)?.post(tap: .cghidEventTap)
    usleep(10_000)
  }
}

let end = arguments.count == 6
  ? CGPoint(x: Double(arguments[4])!, y: Double(arguments[5])!)
  : start
CGEvent(mouseEventSource: source, mouseType: .leftMouseUp, mouseCursorPosition: end,
        mouseButton: .left)?.post(tap: .cghidEventTap)
