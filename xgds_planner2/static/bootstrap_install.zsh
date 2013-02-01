#!/bin/zsh

for file in $(find bootstrap -type f);
{
   rel=${file#bootstrap/}
   dir=$(dirname $rel)
   if ! [[ -d external/$dir ]]
    then echo "Creating "external/$dir
    mkdir -p external/$dir
   fi
   echo ../../bootstrap/$rel "-->" external/$rel
   ln -s -f ../../bootstrap/$rel external/$rel
}
