import '../styles/globals.css'
import Link from 'next/link'

function MyApp({ Component, pageProps }) {
  return (
    <div>
      <nav className="border-b p-6">
        <p className="text-4xl font-bold">Bored Pet Marketplace</p>
        <div className="flex mt-4">
          <Link href="/" className="mr-4 text-teal-400">
              Home
          </Link>
          <Link href="/create-and-list-nft" className="mr-6 text-teal-400">
              Sell a new NFT
          </Link>
          <Link href="/my-nfts" className="mr-6 text-teal-400">
              My NFTs
          </Link>
          <Link href="/my-listed-nfts" className="mr-6 text-teal-400">
              My Listed NFTs
          </Link>
        </div>
      </nav>
      <Component {...pageProps} />
    </div>
  )
}

export default MyApp