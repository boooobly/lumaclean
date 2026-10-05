import {LegalPage, legalMetadata} from "@/components/site/legal-page";

type Props = {params: Promise<{locale: string}>};
export const generateMetadata = ({params}: Props) => legalMetadata(params, "privacy-policy");
export default function Page({params}: Props) {return <LegalPage params={params} kind="privacy-policy"/>;}
