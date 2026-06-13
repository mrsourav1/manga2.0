import React from 'react'
import { Text, View } from 'react-native'

type Props = {
    name:string
    limit:number
}

const Truncate = ({name,limit}: Props) => {
  return (
    <View>
      <Text className='text-black dark:text-white'>{name.length > limit ? name.slice(0, limit+1) + "..." : name}</Text>
    </View>
  )
}

export default Truncate
