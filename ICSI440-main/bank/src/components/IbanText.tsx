interface IbanTextProps {
  iban: string
  /** Emphasise the account-number part (everything after the 10-char bank prefix). */
  bold?: boolean
}

export default function IbanText({ iban, bold = true }: IbanTextProps) {
  if (!bold) return <>{iban}</>
  return (
    <>
      {iban.slice(0, 10)}
      <b className="font-extrabold">{iban.slice(10)}</b>
    </>
  )
}
