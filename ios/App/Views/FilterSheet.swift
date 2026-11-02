import AlbumKit
import SwiftUI

/// Search: who is in the photo, and a range of years.
struct FilterSheet: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        @Bindable var model = model
        let s = model.strings
        let years = yearsOf(model.timeline).sorted()
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    if !model.people.isEmpty {
                        Text(s.who).font(.serif(.title3))
                        PeopleChips(people: model.people, selected: model.filters.people) { id in
                            if model.filters.people.contains(id) { model.filters.people.removeAll { $0 == id } }
                            else { model.filters.people.append(id) }
                        }
                    }
                    Text(s.when).font(.serif(.title3))
                    HStack(spacing: 12) {
                        yearPicker(s.fromYear, selection: $model.filters.fromYear, years: years)
                        yearPicker(s.toYear, selection: $model.filters.toYear, years: years)
                    }
                    if model.filters.isActive {
                        Button(s.clearFilters) { model.filters = Filters() }
                            .font(.body.weight(.semibold))
                    }
                }
                .padding(20)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .background(model.theme.paper)
            .safeAreaInset(edge: .bottom) {
                Button(s.showResults(model.visible.count)) { dismiss() }
                    .buttonStyle(BigButtonStyle(color: model.theme.accent))
                    .padding(.horizontal, 20)
                    .padding(.vertical, 12)
                    .background(.bar)
            }
            .navigationTitle(s.filters)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button(s.close) { dismiss() } }
            }
        }
        .presentationDetents([.medium, .large])
    }

    private func yearPicker(_ title: String, selection: Binding<Int?>, years: [Int]) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title).font(.subheadline.weight(.semibold)).foregroundStyle(model.theme.inkSoft)
            Picker(title, selection: selection) {
                Text(model.strings.anyYear).tag(Int?.none)
                ForEach(years, id: \.self) { year in Text(String(year)).tag(Int?.some(year)) }
            }
            .pickerStyle(.menu)
            .frame(maxWidth: .infinity, minHeight: 50)
            .background(model.theme.card, in: RoundedRectangle(cornerRadius: 12))
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(model.theme.line, lineWidth: 1.5))
        }
    }
}
