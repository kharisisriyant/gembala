import { useRef, useState } from "react"
import { toast } from "sonner"
import { CheckCircle2, Upload, XCircle } from "lucide-react"
import { memberCreateSchema, type MemberCreateInput, type MemberImportResult } from "@gembala/shared"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useImportMembers } from "@/lib/queries"
import { csvToObjects } from "@/lib/csv"

const TEMPLATE_HEADER =
  "name,email,phone,tags,status,dateOfBirth,gender,maritalStatus,address,occupation,notes,photoUrl,baptismStatus,baptismDate,joinedAt"
const TEMPLATE_EXAMPLE =
  'Sarah Wijaya,sarah.w@gmail.com,0812-1111-0001,members;youth,active,2000-05-10,female,single,"123 Main St, Jakarta",Student,,,baptized,2015-06-01,2023-01-15'

type ParsedRow = {
  rowNum: number
  name: string
  data: MemberCreateInput | null
  error: string | null
}

function rowToCandidate(raw: Record<string, string>): unknown {
  return {
    name: raw.name ?? "",
    email: raw.email ?? "",
    phone: raw.phone ?? "",
    tags: (raw.tags ?? "").split(";").map((t) => t.trim()).filter(Boolean),
    status: raw.status || "active",
    joinedAt: raw.joinedAt || undefined,
    dateOfBirth: raw.dateOfBirth || undefined,
    gender: raw.gender || undefined,
    maritalStatus: raw.maritalStatus || undefined,
    address: raw.address ?? "",
    occupation: raw.occupation ?? "",
    notes: raw.notes ?? "",
    photoUrl: raw.photoUrl ?? "",
    baptismStatus: raw.baptismStatus || undefined,
    baptismDate: raw.baptismDate || undefined,
  }
}

function downloadTemplate() {
  const blob = new Blob([`${TEMPLATE_HEADER}\n${TEMPLATE_EXAMPLE}\n`], { type: "text/csv" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = "members-template.csv"
  a.click()
  URL.revokeObjectURL(url)
}

export function ImportMembersDialog({ trigger }: { trigger: React.ReactNode }) {
  const importMembers = useImportMembers()
  const fileInput = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [fileName, setFileName] = useState("")
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [result, setResult] = useState<MemberImportResult | null>(null)

  const reset = () => {
    setFileName("")
    setRows([])
    setResult(null)
    if (fileInput.current) fileInput.current.value = ""
  }

  const onFile = async (file: File) => {
    setResult(null)
    setFileName(file.name)
    const text = await file.text()
    const objects = csvToObjects(text)
    const parsed = objects.map((raw, i): ParsedRow => {
      const candidate = rowToCandidate(raw)
      const check = memberCreateSchema.safeParse(candidate)
      return {
        rowNum: i + 2, // account for header row, 1-indexed
        name: raw.name ?? "",
        data: check.success ? check.data : null,
        error: check.success ? null : check.error.issues[0]?.message ?? "invalid row",
      }
    })
    setRows(parsed)
  }

  const validRows = rows.filter((r) => r.data !== null)

  const submit = async () => {
    try {
      const res = await importMembers.mutateAsync({
        members: validRows.map((r) => r.data!),
      })
      setResult(res)
      if (res.errors.length === 0) {
        toast.success(`Imported ${res.created.length} members`)
      } else {
        toast.warning(`Imported ${res.created.length} of ${validRows.length}, ${res.errors.length} failed`)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed")
    }
  }

  const close = () => {
    setOpen(false)
    reset()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import members from CSV</DialogTitle>
          <DialogDescription>
            Header row required. Separate multiple tags in a cell with <code>;</code>, e.g.{" "}
            <code>members;youth</code>. Only <code>name</code> and <code>tags</code> are required.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {!result && (
            <div className="flex flex-wrap items-center gap-3">
              <input
                ref={fileInput}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) void onFile(file)
                }}
              />
              <Button variant="outline" onClick={() => fileInput.current?.click()}>
                <Upload className="size-4" /> Choose CSV file
              </Button>
              {fileName && <span className="text-muted-foreground text-sm">{fileName}</span>}
              <Button variant="ghost" size="sm" onClick={downloadTemplate} className="ml-auto">
                Download template
              </Button>
            </div>
          )}

          {!result && rows.length > 0 && (
            <>
              <div className="text-muted-foreground text-sm">
                {validRows.length} of {rows.length} rows look valid.
                {rows.length - validRows.length > 0 &&
                  ` ${rows.length - validRows.length} will be skipped.`}
              </div>
              <div className="max-h-[45vh] overflow-y-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="w-12">Row</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow key={r.rowNum}>
                        <TableCell className="text-muted-foreground">{r.rowNum}</TableCell>
                        <TableCell>{r.name || "—"}</TableCell>
                        <TableCell>
                          {r.data ? (
                            <span className="text-primary flex items-center gap-1.5 text-sm">
                              <CheckCircle2 className="size-4" /> Ready
                            </span>
                          ) : (
                            <span className="flex items-center gap-1.5 text-sm text-destructive">
                              <XCircle className="size-4" /> {r.error}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}

          {result && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="text-primary size-4" />
                {result.created.length} member{result.created.length === 1 ? "" : "s"} imported
              </div>
              {result.errors.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-sm text-destructive">
                    <XCircle className="size-4" /> {result.errors.length} failed
                  </div>
                  <div className="max-h-[30vh] overflow-y-auto rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/40">
                          <TableHead className="w-12">Row</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Error</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {result.errors.map((e) => (
                          <TableRow key={e.row}>
                            <TableCell className="text-muted-foreground">{e.row + 2}</TableCell>
                            <TableCell>{e.name || "—"}</TableCell>
                            <TableCell className="text-destructive">{e.message}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" onClick={reset}>
              {result ? "Close" : "Cancel"}
            </Button>
          </DialogClose>
          {!result && (
            <Button onClick={submit} disabled={validRows.length === 0 || importMembers.isPending}>
              {importMembers.isPending ? "Importing…" : `Import ${validRows.length} member${validRows.length === 1 ? "" : "s"}`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
