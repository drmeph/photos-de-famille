import AlbumKit
import SwiftUI

/// A person's initials in a colored circle (same color as on the website), or a check when selected.
struct Avatar: View {
    let name: String
    var checked = false
    var size: CGFloat = 36
    @Environment(AppModel.self) private var model

    var body: some View {
        ZStack {
            Circle().fill(checked ? Color.white : Color(hue: avatarHue(name) / 360, saturation: 0.53, brightness: 0.57))
            if checked {
                Image(systemName: "checkmark").font(.system(size: size * 0.45, weight: .bold)).foregroundStyle(model.theme.accent)
            } else {
                Text(initials(name)).font(.system(size: size * 0.36, weight: .heavy)).foregroundStyle(.white)
            }
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }
}

/// Big tappable name buttons; selected ones are filled. Optionally "Add a person".
struct PeopleChips: View {
    let people: [Person]
    let selected: [String]
    let onToggle: (String) -> Void
    var onAdd: ((String) async -> Void)? = nil

    @Environment(AppModel.self) private var model
    @State private var adding = false
    @State private var newName = ""

    var body: some View {
        let s = model.strings
        FlowLayout(spacing: 8) {
            ForEach(people) { person in
                let on = selected.contains(person.id)
                Button { onToggle(person.id) } label: {
                    HStack(spacing: 8) {
                        Avatar(name: person.name, checked: on)
                        Text(person.name).font(.body.weight(.semibold))
                    }
                    .padding(.leading, 6)
                    .padding(.trailing, 14)
                    .frame(minHeight: 50)
                    .foregroundStyle(on ? .white : model.theme.ink)
                    .background(on ? model.theme.accent : model.theme.card, in: Capsule())
                    .overlay(Capsule().stroke(on ? model.theme.accent : model.theme.line, lineWidth: 1.5))
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(on ? .isSelected : [])
            }
            if onAdd != nil {
                Button { adding = true } label: {
                    Label(s.addPerson, systemImage: "plus")
                        .font(.body.weight(.semibold))
                        .padding(.horizontal, 14)
                        .frame(minHeight: 50)
                        .foregroundStyle(model.theme.accent)
                        .overlay(Capsule().strokeBorder(model.theme.accentLine, style: StrokeStyle(lineWidth: 1.5, dash: [5, 4])))
                }
                .buttonStyle(.plain)
            }
        }
        .alert(s.addPerson, isPresented: $adding) {
            TextField(s.newPersonPlaceholder, text: $newName)
                .textInputAutocapitalization(.words)
            Button(s.add) {
                let name = newName.trimmingCharacters(in: .whitespaces)
                newName = ""
                if !name.isEmpty, let onAdd { Task { await onAdd(name) } }
            }
            Button(s.cancel, role: .cancel) { newName = "" }
        }
    }
}
