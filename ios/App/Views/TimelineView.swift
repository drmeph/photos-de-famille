import AlbumKit
import SwiftUI

/// The timeline: "By date" (years, then months) or "Latest additions" (days, then who added).
struct AlbumTimelineView: View {
    let onOpen: (TimelineEntry) -> Void

    @Environment(AppModel.self) private var model
    @State private var topId: String?

    var body: some View {
        let s = model.strings
        let visible = model.visible
        let years = model.sort == .date ? groupByYear(visible) : []
        let days = model.sort == .added ? groupByAddedDay(visible) : []

        GeometryReader { geo in
            let width = max(200, geo.size.width - 32)
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 28) {
                        header.id("top")
                        if model.timeline.isEmpty {
                            EmptyAlbumView()
                        } else if visible.isEmpty {
                            Text(s.noMatch).foregroundStyle(model.theme.inkSoft).frame(maxWidth: .infinity).padding(.top, 40)
                        }
                        ForEach(years) { year in
                            YearSection(year: year, width: width, onOpen: onOpen).id(year.year)
                        }
                        ForEach(days) { day in
                            DaySection(day: day, width: width, onOpen: onOpen).id(day.id)
                        }
                    }
                    .scrollTargetLayout()
                    .padding(.horizontal, 16)
                    .padding(.bottom, 24)
                }
                .scrollPosition(id: $topId, anchor: .top)
                .refreshable { await model.loadAll() }
                .safeAreaInset(edge: .top, spacing: 0) {
                    if years.count > 1 {
                        let active = years.contains(where: { $0.year == topId }) ? topId ?? years[0].year : years[0].year
                        YearStrip(years: years.map(\.year), active: active) { year in
                            withAnimation { proxy.scrollTo(year, anchor: .top) }
                        }
                    }
                }
            }
        }
        .background(model.theme.paper)
    }

    @ViewBuilder private var header: some View {
        @Bindable var model = model
        VStack(alignment: .leading, spacing: 14) {
            if !model.config.welcome.isEmpty, !model.filters.isActive {
                Text(model.config.welcome)
                    .font(.serif(.title3, weight: .regular).italic())
                    .padding(16)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(model.theme.card, in: RoundedRectangle(cornerRadius: 16))
                    .overlay(alignment: .leading) {
                        UnevenRoundedRectangle(topLeadingRadius: 16, bottomLeadingRadius: 16).fill(model.theme.accent).frame(width: 5)
                    }
            }
            if !model.timeline.isEmpty {
                SortToggle(sort: $model.sort)
            }
            if model.filters.isActive {
                FilterPills()
            }
        }
        .padding(.top, 8)
    }
}

/// "Par date" / "Derniers ajouts": two big buttons.
struct SortToggle: View {
    @Binding var sort: SortMode
    @Environment(AppModel.self) private var model

    var body: some View {
        let s = model.strings
        HStack(spacing: 4) {
            option(.date, s.sortDate, "calendar")
            option(.added, s.sortAdded, "clock")
        }
        .padding(4)
        .background(model.theme.paperDeep, in: Capsule())
        .overlay(Capsule().stroke(model.theme.line))
    }

    private func option(_ mode: SortMode, _ title: String, _ icon: String) -> some View {
        Button {
            withAnimation(.snappy) { sort = mode }
        } label: {
            Label(title, systemImage: icon)
                .font(.subheadline.weight(.semibold))
                .padding(.horizontal, 14)
                .frame(minHeight: 44)
                .foregroundStyle(sort == mode ? model.theme.accent : model.theme.inkSoft)
                .background(sort == mode ? model.theme.card : .clear, in: Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(sort == mode ? .isSelected : [])
    }
}

/// Active filters as removable pills, with the result count.
struct FilterPills: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        let s = model.strings
        FlowLayout(spacing: 8) {
            ForEach(model.filters.people, id: \.self) { id in
                let name = model.people.first { $0.id == id }?.name ?? id
                pill { HStack(spacing: 6) { Avatar(name: name, size: 28); Text(name); Image(systemName: "xmark") } } action: {
                    model.filters.people.removeAll { $0 == id }
                }
            }
            if model.filters.fromYear != nil || model.filters.toYear != nil {
                pill {
                    HStack(spacing: 6) {
                        Image(systemName: "calendar")
                        Text("\(model.filters.fromYear.map { String($0) } ?? "…") – \(model.filters.toYear.map { String($0) } ?? "…")")
                        Image(systemName: "xmark")
                    }
                } action: {
                    model.filters.fromYear = nil
                    model.filters.toYear = nil
                }
            }
            Text(s.photoCount(model.visible.count)).font(.subheadline.weight(.semibold)).foregroundStyle(model.theme.inkSoft)
                .frame(minHeight: 40)
        }
    }

    private func pill<Content: View>(@ViewBuilder _ content: () -> Content, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            content()
                .font(.subheadline.weight(.semibold))
                .padding(.leading, 6)
                .padding(.trailing, 12)
                .frame(minHeight: 40)
                .background(model.theme.accentSoft, in: Capsule())
                .overlay(Capsule().stroke(model.theme.accentLine, lineWidth: 1.5))
        }
        .buttonStyle(.plain)
    }
}

/// Years to jump to; the one on screen is highlighted.
struct YearStrip: View {
    let years: [String]
    let active: String
    let onTap: (String) -> Void
    @Environment(AppModel.self) private var model

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(years, id: \.self) { year in
                        Button { onTap(year) } label: {
                            Text(year)
                                .font(.serif(.headline))
                                .padding(.horizontal, 16)
                                .frame(minHeight: 44)
                                .foregroundStyle(year == active ? .white : model.theme.ink)
                                .background(year == active ? model.theme.accent : model.theme.card, in: Capsule())
                                .overlay(Capsule().stroke(year == active ? .clear : model.theme.line, lineWidth: 1.5))
                        }
                        .buttonStyle(.plain)
                        .id(year)
                    }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 8)
            }
            .background(.bar)
            .onChange(of: active) { _, year in withAnimation { proxy.scrollTo(year, anchor: .center) } }
        }
    }
}

struct YearSection: View {
    let year: YearGroup
    let width: Double
    let onOpen: (TimelineEntry) -> Void
    @Environment(AppModel.self) private var model

    var body: some View {
        let s = model.strings
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .firstTextBaseline, spacing: 10) {
                Text(year.year).font(.serif(.largeTitle))
                Text(s.photoCount(year.photos.count)).font(.subheadline.weight(.semibold)).foregroundStyle(model.theme.inkSoft)
            }
            PhotoGrid(
                groups: year.months.map { GridGroup(key: $0.key, photos: $0.photos) },
                width: width,
                label: { group, width in
                    let full = s.monthName(group.key)
                    return Double(full.count) * 11 > width ? s.monthName(group.key, short: true) : full
                },
                onOpen: onOpen
            )
        }
    }
}

struct DaySection: View {
    let day: DayGroup
    let width: Double
    let onOpen: (TimelineEntry) -> Void
    @Environment(AppModel.self) private var model

    var body: some View {
        let s = model.strings
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .firstTextBaseline, spacing: 10) {
                Text(s.addedDay(day.key)).font(.serif(.title))
                Text(s.photoCount(day.photos.count)).font(.subheadline.weight(.semibold)).foregroundStyle(model.theme.inkSoft)
            }
            PhotoGrid(
                groups: splitByUploader(day.photos).map { GridGroup(key: "\(day.key)|\($0.by)", photos: $0.photos, by: $0.by) },
                width: width,
                label: { group, width in
                    guard let by = group.by, !by.isEmpty else { return "" }
                    let name = model.name(of: by)
                    let full = "\(s.byName(name)) · \(s.photoCount(group.photos.count))"
                    if Double(full.count) * 9.5 <= width { return full }
                    return Double(s.byName(name).count) * 9.5 <= width ? s.byName(name) : name
                },
                showYear: true,
                onOpen: onOpen
            )
        }
    }
}

struct EmptyAlbumView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        let s = model.strings
        VStack(spacing: 14) {
            ZStack {
                RoundedRectangle(cornerRadius: 8).fill(.white).frame(width: 110, height: 124)
                    .shadow(color: .black.opacity(0.12), radius: 10, y: 6).rotationEffect(.degrees(-8)).offset(x: -30)
                RoundedRectangle(cornerRadius: 8).fill(.white).frame(width: 110, height: 124)
                    .overlay(alignment: .top) {
                        RoundedRectangle(cornerRadius: 4).fill(model.theme.accentSoft).frame(width: 90, height: 80).padding(.top, 10)
                            .overlay(Image(systemName: "photo").font(.largeTitle).foregroundStyle(model.theme.accent))
                    }
                    .shadow(color: .black.opacity(0.12), radius: 10, y: 6).rotationEffect(.degrees(7)).offset(x: 30)
            }
            .frame(height: 160)
            Text(s.emptyTitle).font(.serif(.title))
            Text(s.emptyText).multilineTextAlignment(.center).foregroundStyle(model.theme.inkSoft)
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 40)
    }
}
