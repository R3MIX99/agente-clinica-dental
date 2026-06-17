# Graph Report - .  (2026-05-22)

## Corpus Check
- Corpus is ~30,574 words - fits in a single context window. You may not need a graph.

## Summary
- 483 nodes · 945 edges · 19 communities (16 shown, 3 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 9 edges (avg confidence: 0.84)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_UI Component Library|UI Component Library]]
- [[_COMMUNITY_Feature Pages & Actions|Feature Pages & Actions]]
- [[_COMMUNITY_Settings Module|Settings Module]]
- [[_COMMUNITY_Project Dependencies|Project Dependencies]]
- [[_COMMUNITY_Patients Module|Patients Module]]
- [[_COMMUNITY_Patient Profile|Patient Profile]]
- [[_COMMUNITY_AI Agents Module|AI Agents Module]]
- [[_COMMUNITY_Navigation & Layout|Navigation & Layout]]
- [[_COMMUNITY_Doctor Profile|Doctor Profile]]
- [[_COMMUNITY_Doctors Module|Doctors Module]]
- [[_COMMUNITY_Component Config|Component Config]]
- [[_COMMUNITY_TypeScript Config|TypeScript Config]]
- [[_COMMUNITY_Mobile Header|Mobile Header]]
- [[_COMMUNITY_Project Documentation|Project Documentation]]
- [[_COMMUNITY_Root Layout & Theme|Root Layout & Theme]]
- [[_COMMUNITY_ESLint Config|ESLint Config]]
- [[_COMMUNITY_Next Config|Next Config]]
- [[_COMMUNITY_PostCSS Config|PostCSS Config]]

## God Nodes (most connected - your core abstractions)
1. `cn()` - 107 edges
2. `createServerClient()` - 54 edges
3. `compilerOptions` - 16 edges
4. `Button()` - 16 edges
5. `Input()` - 9 edges
6. `Label()` - 9 edges
7. `useAtencion()` - 9 edges
8. `Dashboard Next.js Project` - 9 edges
9. `PacienteFichaClient()` - 7 edges
10. `DialogContent()` - 7 edges

## Surprising Connections (you probably didn't know these)
- `Dashboard Next.js Project` --references--> `File Icon SVG`  [INFERRED]
  README.md → public/file.svg
- `Dashboard Next.js Project` --references--> `Globe Icon SVG`  [INFERRED]
  README.md → public/globe.svg
- `Dashboard Next.js Project` --references--> `Next.js Wordmark Logo SVG`  [INFERRED]
  README.md → public/next.svg
- `Dashboard Next.js Project` --references--> `Vercel Triangle Logo SVG`  [INFERRED]
  README.md → public/vercel.svg
- `Dashboard Next.js Project` --references--> `Browser Window Icon SVG`  [INFERRED]
  README.md → public/window.svg

## Communities (19 total, 3 thin omitted)

### Community 0 - "UI Component Library"
Cohesion: 0.06
Nodes (44): cn(), Avatar(), AvatarBadge(), AvatarFallback(), AvatarGroup(), AvatarGroupCount(), AvatarImage(), Card() (+36 more)

### Community 1 - "Feature Pages & Actions"
Cohesion: 0.06
Nodes (50): AgentesClient(), AgentesPage(), metadata, metadata, metadata, actualizarCita(), crearCita(), DatosCita (+42 more)

### Community 2 - "Settings Module"
Cohesion: 0.06
Nodes (34): DatosClinica, FaqItem, guardarAjustes(), AjustesClient(), AjustesForm, ajustesSchema, ClinicaInfo, FaqItem (+26 more)

### Community 3 - "Project Dependencies"
Cohesion: 0.05
Nodes (36): dependencies, class-variance-authority, clsx, framer-motion, @hookform/resolvers, lucide-react, next, next-themes (+28 more)

### Community 4 - "Patients Module"
Cohesion: 0.07
Nodes (31): actualizarPaciente(), agendarCitaPaciente(), crearPaciente(), DatosCitaRapida, DatosPaciente, eliminarPaciente(), mexLocalToISO(), buildTimeline() (+23 more)

### Community 5 - "Patient Profile"
Cohesion: 0.09
Nodes (28): actualizarDoctoresFicha(), agendarCitaFicha(), agregarNotaClinica(), DatosCitaFicha, mexLocalToISO(), buildTimeline(), CANAL_LABEL, Cita (+20 more)

### Community 6 - "AI Agents Module"
Cohesion: 0.10
Nodes (22): actualizarAgente(), crearAgente(), DatosAgente, toggleActivoAgente(), Agente, AgenteForm, agenteSchema, FORM_DEFAULT (+14 more)

### Community 7 - "Navigation & Layout"
Cohesion: 0.10
Nodes (21): AppSidebar(), GlobalAtencionListener(), MobileBottomNav(), TAB_ITEMS, navItems, SidebarNav(), AtencionContext, AtencionContextValue (+13 more)

### Community 8 - "Doctor Profile"
Cohesion: 0.10
Nodes (22): agregarBloqueHorario(), DatosBloqueHorario, eliminarBloqueHorario(), agruparCitasPorDia(), CANAL_ESTILO, CANAL_NOMBRE, CitaDoctor, DIA_NOMBRE (+14 more)

### Community 9 - "Doctors Module"
Cohesion: 0.10
Nodes (19): actualizarDoctor(), crearDoctor(), DatosDoctor, eliminarDoctor(), agruparCitasPorDia(), CitaDoctorFicha, DIA_NOMBRE, DIAS_ORDEN (+11 more)

### Community 10 - "Component Config"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 11 - "TypeScript Config"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 12 - "Mobile Header"
Cohesion: 0.14
Nodes (12): MobileHeader(), DropdownMenu(), DropdownMenuCheckboxItem(), DropdownMenuContent(), DropdownMenuItem(), DropdownMenuLabel(), DropdownMenuRadioItem(), DropdownMenuSeparator() (+4 more)

### Community 13 - "Project Documentation"
Cohesion: 0.16
Nodes (14): Next.js Agent Rules, Next.js Breaking Changes Warning, node_modules/next/dist/docs/ Guide Reference, CLAUDE.md Configuration, create-next-app CLI, Geist Font, Next.js Framework, Dashboard Next.js Project (+6 more)

### Community 14 - "Root Layout & Theme"
Cohesion: 0.28
Nodes (5): geistMono, geistSans, metadata, ThemeProvider(), Toaster()

## Knowledge Gaps
- **196 isolated node(s):** `$schema`, `style`, `rsc`, `tsx`, `config` (+191 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `UI Component Library` to `Feature Pages & Actions`, `Settings Module`, `Project Dependencies`, `Patients Module`, `Patient Profile`, `AI Agents Module`, `Navigation & Layout`, `Doctor Profile`, `Doctors Module`, `Mobile Header`?**
  _High betweenness centrality (0.337) - this node is a cross-community bridge._
- **Why does `clsx` connect `Project Dependencies` to `UI Component Library`?**
  _High betweenness centrality (0.116) - this node is a cross-community bridge._
- **What connects `$schema`, `style`, `rsc` to the rest of the system?**
  _198 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `UI Component Library` be split into smaller, more focused modules?**
  _Cohesion score 0.06057692307692308 - nodes in this community are weakly interconnected._
- **Should `Feature Pages & Actions` be split into smaller, more focused modules?**
  _Cohesion score 0.057859703020993344 - nodes in this community are weakly interconnected._
- **Should `Settings Module` be split into smaller, more focused modules?**
  _Cohesion score 0.058279370952821465 - nodes in this community are weakly interconnected._
- **Should `Project Dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.05405405405405406 - nodes in this community are weakly interconnected._