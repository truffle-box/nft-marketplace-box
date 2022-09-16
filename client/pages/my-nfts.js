import Web3 from 'web3';
import { useEffect, useState } from 'react'
import axios from 'axios'
import Web3Modal from 'web3modal'
import { useRouter } from 'next/router'
import { Marketplace, BoredPetsNFT } from './contracts-import'

export default function MyAssets() {
  const [nfts, setNfts] = useState([])
  const [loadingState, setLoadingState] = useState('not-loaded')
  const router = useRouter()

  useEffect(() => { loadNFTs() }, [])

  async function loadNFTs() {
    const web3Modal = new Web3Modal()
    const provider = await web3Modal.connect()
    const web3 = new Web3(provider)
    const networkId = await web3.eth.net.getId()
    const marketPlaceContract = new web3.eth.Contract(Marketplace.abi, Marketplace.networks[networkId].address)
    const boredPetsContractAddress = BoredPetsNFT.networks[networkId].address
    const boredPetsContract = new web3.eth.Contract(BoredPetsNFT.abi, boredPetsContractAddress)
    const accounts = await web3.eth.getAccounts()
    const data = await marketPlaceContract.methods.getMyNfts().call({from: accounts[0]})

    const nfts = await Promise.all(data.map(async i => {
      try {
        const tokenURI = await boredPetsContract.methods.tokenURI(i.tokenId).call()
        const meta = await axios.get(tokenURI)
        let nft = {
          price: i.price,
          tokenId: i.tokenId,
          seller: i.seller,
          owner: i.buyer,
          image: meta.data.image,
          name: meta.data.name,
          description: meta.data.description,
          tokenURI: tokenURI
        }
        return nft
      } catch(err) {
        console.log(err)
        return null
      }
    }))
    setNfts(nfts.filter(nft => nft !== null))
    setLoadingState('loaded')
  }

  function listNFT(nft) {
    router.push(`/resell-nft?id=${nft.tokenId}&tokenURI=${nft.tokenURI}`)
  }

  if (loadingState === 'loaded' && !nfts.length) {
    return (<h1 className="py-10 px-20 text-3xl">No NFTs owned</h1>);
  } else {
    return (
      <div className="flex justify-center">
        <div className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4">
            {
              nfts.map((nft, i) => (
                <div key={i} className="border shadow rounded-xl overflow-hidden">
                  <img src={nft.image} className="rounded" />
                  <div className="p-4">
                    <p style={{ height: '64px' }} className="text-2xl font-semibold">{nft.name}</p>
                    <div style={{ height: '70px', overflow: 'hidden' }}>
                      <p className="text-gray-400">{nft.description}</p>
                    </div>
                  </div>
                  <div className="p-4 bg-black">
                    <p className="text-2xl font-bold text-white">Price - {Web3.utils.fromWei(nft.price, "ether")} Eth</p>
                    <button className="mt-4 w-full bg-teal-400 text-white font-bold py-2 px-12 rounded" onClick={() => listNFT(nft)}>List</button>
                  </div>
                </div>
              ))
            }
          </div>
        </div>
      </div>
    );
  }
}